"use server";

import type { ExtractedDocument } from "@/features/imports/types/document-types";
import { extractDocx } from "@/features/imports/adapters/docx-adapter";
import { extractPdf, PDFEncryptedError } from "@/features/imports/adapters/pdf-adapter";
import { validateDocumentFile } from "@/features/imports/utils/document-validation";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MAX_EXTRACTED_CHARS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type ExtractResult = { document: ExtractedDocument } | { error: string };

export async function extractDocument(formData: FormData): Promise<ExtractResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return { error: "Vui lòng chọn tệp." };

  if (file.size === 0) return { error: "Tệp trống." };
  if (file.size > DOCUMENT_MAX_BYTES) {
    return {
      error: `Tệp quá lớn. Kích thước tối đa là ${Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const validation = validateDocumentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (!validation.ok) return { error: validation.error };

  const buffer = await file.arrayBuffer();

  let document: ExtractedDocument;

  try {
    if (validation.sourceType === "docx") {
      document = await extractDocx(buffer);
    } else {
      document = await extractPdf(buffer);
    }
  } catch (err) {
    if (err instanceof PDFEncryptedError) {
      return {
        error: "PDF này được bảo vệ bằng mật khẩu. FlashLearn chưa hỗ trợ mở PDF có mật khẩu.",
      };
    }
    return { error: "Không thể đọc tệp này. Hãy kiểm tra tệp chưa bị hỏng." };
  }

  if (document.totalCharacters > DOCUMENT_MAX_EXTRACTED_CHARS) {
    return { error: "Nội dung tài liệu quá dài để xử lý." };
  }

  if (
    document.sourceType === "pdf" &&
    document.blocks.length === 0 &&
    (document.pageCount ?? 0) > 0
  ) {
    return {
      error: "PDF này không có văn bản có thể đọc. FlashLearn hiện chưa hỗ trợ PDF scan/ảnh.",
    };
  }

  return { document };
}
