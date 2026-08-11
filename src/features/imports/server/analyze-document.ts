"use server";

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
import { DOCUMENT_ANALYSIS_MAX_AI_SECTIONS, DOCUMENT_MAX_EXTRACTED_CHARS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type AnalyzeResult = { document: AnalyzedDocument } | { error: string };

function sectionText(section: BuiltSection): string {
  const parts: string[] = [];
  if (section.heading) parts.push(section.heading);
  for (const block of section.blocks) {
    if (block.type === "heading" || block.type === "paragraph") {
      parts.push(block.text);
    } else if (block.type === "table") {
      for (const row of block.rows) {
        parts.push(row.join(" | "));
      }
    }
  }
  return parts.join("\n");
}

export async function analyzeDocument(extracted: ExtractedDocument): Promise<AnalyzeResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };

  if (!extracted || typeof extracted !== "object" || !Array.isArray(extracted.blocks)) {
    return { error: "Dữ liệu tài liệu không hợp lệ." };
  }

  if (extracted.totalCharacters > DOCUMENT_MAX_EXTRACTED_CHARS) {
    return { error: "Nội dung tài liệu quá dài để phân tích." };
  }

  const builtSections = buildSections(extracted.blocks);
  if (builtSections.length === 0) {
    return { error: "Tài liệu không có nội dung để phân tích." };
  }

  const sections: AnalyzedDocumentSection[] = [];
  let sourceChars = 0;
  let aiInputChars = 0;
  let aiCallCount = 0;
  let deterministicCount = 0;

  for (let i = 0; i < builtSections.length; i++) {
    const sec = builtSections[i]!;
    const detResult = classifySection(sec);

    if (detResult.kind === "empty") continue;

    sourceChars += sectionText(sec).length;

    if (detResult.confidence >= DETERMINISTIC_CONFIDENCE_THRESHOLD) {
      deterministicCount += 1;
      sections.push({
        index: i,
        heading: sec.heading,
        blocks: sec.blocks,
        kind: detResult.kind,
        confidence: detResult.confidence,
        detectedBy: "deterministic",
        reason: detResult.reason,
      });
      continue;
    }

    // Below threshold — attempt AI classification
    if (aiCallCount >= DOCUMENT_ANALYSIS_MAX_AI_SECTIONS) {
      sections.push({
        index: i,
        heading: sec.heading,
        blocks: sec.blocks,
        kind: detResult.kind,
        confidence: detResult.confidence,
        detectedBy: "deterministic",
        reason: `${detResult.reason} (AI limit reached)`,
      });
      deterministicCount += 1;
      continue;
    }

    const secText = sectionText(sec);
    aiInputChars += secText.length;
    aiCallCount += 1;

    try {
      const classifier = new GeminiDocumentClassifier();
      const aiResult = await classifier.classify(secText);

      sections.push({
        index: i,
        heading: sec.heading,
        blocks: sec.blocks,
        kind: aiResult.kind,
        confidence: aiResult.confidence,
        detectedBy: "ai",
        reason: aiResult.reason ?? detResult.reason,
      });
    } catch {
      // AI failure: retain deterministic result with original confidence.
      sections.push({
        index: i,
        heading: sec.heading,
        blocks: sec.blocks,
        kind: detResult.kind,
        confidence: detResult.confidence,
        detectedBy: "deterministic",
        reason: `${detResult.reason} (AI unavailable)`,
      });
      deterministicCount += 1;
    }
  }

  return {
    document: {
      sourceType: extracted.sourceType,
      title: extracted.title,
      sections,
      totalCharacters: extracted.totalCharacters,
      analysis: {
        deterministicSections: deterministicCount,
        aiSections: aiCallCount,
        sourceChars,
        aiInputChars,
      },
    },
  };
}
