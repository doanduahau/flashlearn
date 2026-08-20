"use server";

import type { Json } from "@/lib/supabase/types";
import type {
  AnalyzedDocument,
  AnalyzedDocumentSection,
  ExtractedDocument,
} from "@/features/imports/types/document-types";
import { GeminiDocumentClassifier } from "@/features/imports/adapters/gemini-classifier";
import { buildSections, type BuiltSection } from "@/features/imports/utils/section-builder";
import {
  classifySection,
  DETERMINISTIC_CONFIDENCE_THRESHOLD,
} from "@/features/imports/utils/document-classifier";
import {
  aiPlanTier,
  DOCUMENT_PROCESSING_LIMITS,
  estimateContentCredits,
} from "@/features/entitlements/ai-job-limits";
import { getEffectivePlan, reserveUsage } from "@/features/entitlements/server/entitlement-service";
import {
  linkJobReservation,
  loadProcessingJobOutput,
  runProcessingJobPhase,
  storeProcessingJobOutput,
} from "@/features/entitlements/server/processing-job-service";
import { createProviderCallBudget } from "@/features/entitlements/server/provider-call-budget";
import { createClient } from "@/lib/supabase/server";
import { recordDocumentTelemetry } from "@/lib/telemetry/telemetry";

type AnalyzeResult = { document: AnalyzedDocument } | { error: string };

function sectionText(section: BuiltSection): string {
  const parts: string[] = [];
  if (section.heading) parts.push(section.heading);
  for (const block of section.blocks) {
    if (block.type === "heading" || block.type === "paragraph") parts.push(block.text);
    else for (const row of block.rows) parts.push(row.join(" | "));
  }
  return parts.join("\n");
}

function parseCachedAnalysis(value: Json): AnalyzedDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, Json | undefined>;
  if (!Array.isArray(candidate.sections) || typeof candidate.totalCharacters !== "number")
    return null;
  return value as unknown as AnalyzedDocument;
}

export async function analyzeDocument(extracted: ExtractedDocument): Promise<AnalyzeResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { error: "Phiên đăng nhập đã hết hạn." };

  if (!extracted || typeof extracted !== "object" || !Array.isArray(extracted.blocks)) {
    return { error: "Dữ liệu tài liệu không hợp lệ." };
  }
  const processingJob = extracted.processingJob;
  if (!processingJob || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(processingJob.id)) {
    return { error: "Phiên xử lý tài liệu không hợp lệ. Hãy chọn lại tệp." };
  }

  const cached = await loadProcessingJobOutput(processingJob.id, userId, "document_analysis").catch(
    () => null,
  );
  if (cached) {
    const document = parseCachedAnalysis(cached.payload);
    if (document) return { document };
  }

  const plan = await getEffectivePlan(userId);
  const tier = aiPlanTier(plan);
  const limits = DOCUMENT_PROCESSING_LIMITS[extracted.sourceType][tier];
  if (extracted.totalCharacters > limits.characters) {
    return { error: "Nội dung tài liệu quá dài để phân tích với gói hiện tại." };
  }

  const builtSections = buildSections(extracted.blocks);
  if (builtSections.length === 0) return { error: "Tài liệu không có nội dung để phân tích." };

  const sections: AnalyzedDocumentSection[] = [];
  const uncertain: Array<{
    index: number;
    section: BuiltSection;
    text: string;
    deterministic: ReturnType<typeof classifySection>;
  }> = [];
  let sourceChars = 0;
  let deterministicCount = 0;

  for (let index = 0; index < builtSections.length; index += 1) {
    const section = builtSections[index]!;
    const deterministic = classifySection(section);
    if (deterministic.kind === "empty") continue;
    const text = sectionText(section);
    sourceChars += text.length;
    if (deterministic.confidence >= DETERMINISTIC_CONFIDENCE_THRESHOLD) {
      deterministicCount += 1;
      sections.push({
        index,
        heading: section.heading,
        blocks: section.blocks,
        kind: deterministic.kind,
        confidence: deterministic.confidence,
        detectedBy: "deterministic",
        reason: deterministic.reason,
      });
    } else {
      uncertain.push({ index, section, text, deterministic });
    }
  }

  let aiInputChars = 0;
  let aiSections = 0;
  let quotaUnavailable = false;
  let providerDegraded = false;
  let reservationId: string | null = null;

  if (uncertain.length > 0) {
    const reservation = await reserveUsage({
      userId,
      usageKey: "ai.content_credits.monthly",
      requestedAmount: estimateContentCredits(sourceChars, limits.cards),
      idempotencyKey: processingJob.id,
      correlationId: processingJob.correlationId,
    });
    reservationId = reservation.reservation_id ?? null;
    quotaUnavailable = reservation.wouldBlock && reservation.enforcementMode === "block";
    if (reservationId) {
      await linkJobReservation({
        jobId: processingJob.id,
        userId,
        reservationId,
        purpose: "content_credit",
      });
    }

    if (!quotaUnavailable) {
      await runProcessingJobPhase({ id: processingJob.id, userId }, async () => {
        const classifier = new GeminiDocumentClassifier(
          createProviderCallBudget({ jobId: processingJob.id, userId }),
        );
        for (const candidate of uncertain) {
          aiInputChars += candidate.text.length;
          try {
            const result = await classifier.classify(candidate.text);
            aiSections += 1;
            sections.push({
              index: candidate.index,
              heading: candidate.section.heading,
              blocks: candidate.section.blocks,
              kind: result.kind,
              confidence: result.confidence,
              detectedBy: "ai",
              reason: result.reason ?? candidate.deterministic.reason,
            });
          } catch {
            providerDegraded = true;
            deterministicCount += 1;
            sections.push({
              index: candidate.index,
              heading: candidate.section.heading,
              blocks: candidate.section.blocks,
              kind: candidate.deterministic.kind,
              confidence: candidate.deterministic.confidence,
              detectedBy: "deterministic",
              reason: `${candidate.deterministic.reason} (AI unavailable)`,
            });
          }
        }
      });
    } else {
      for (const candidate of uncertain) {
        deterministicCount += 1;
        sections.push({
          index: candidate.index,
          heading: candidate.section.heading,
          blocks: candidate.section.blocks,
          kind: candidate.deterministic.kind,
          confidence: candidate.deterministic.confidence,
          detectedBy: "deterministic",
          reason: `${candidate.deterministic.reason} (AI quota unavailable)`,
        });
      }
    }
  }

  sections.sort((left, right) => left.index - right.index);
  const warnings = [
    ...(quotaUnavailable
      ? ["Đã hết lượt AI; tài liệu được phân loại bằng quy tắc thông thường."]
      : []),
    ...(providerDegraded
      ? ["Một số mục được phân loại bằng quy tắc thông thường vì AI tạm thời không khả dụng."]
      : []),
  ];
  const document: AnalyzedDocument = {
    sourceType: extracted.sourceType,
    title: extracted.title,
    sections,
    totalCharacters: extracted.totalCharacters,
    analysis: { deterministicSections: deterministicCount, aiSections, sourceChars, aiInputChars },
    processingJob,
    warnings,
  };

  await storeProcessingJobOutput({
    jobId: processingJob.id,
    userId,
    outputKind: "document_analysis",
    payload: document as unknown as Json,
  });
  recordDocumentTelemetry({
    correlationId: processingJob.correlationId,
    operation: "analyze",
    outcome: providerDegraded || quotaUnavailable ? "degraded" : "succeeded",
    processingPath: aiSections > 0 ? "mixed" : "deterministic",
    inputSize: extracted.totalCharacters,
    outputCount: sections.length,
  });
  return { document };
}
