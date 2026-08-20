import {
  DOCUMENT_ARCHIVE_LIMITS,
  PDF_OBJECT_LIMITS,
  type AiPlanTier,
  type DocumentSource,
} from "@/features/entitlements/ai-job-limits";

export type HardenedFileResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "FILE_SIGNATURE_MISMATCH"
        | "DOCX_INVALID_ARCHIVE"
        | "DOCX_ARCHIVE_LIMIT"
        | "DOCX_UNSAFE_CONTENT"
        | "PDF_OBJECT_LIMIT";
      message: string;
    };

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_MIN_EOCD_BYTES = 22;
const ZIP_MAX_COMMENT_BYTES = 65_535;

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function findZipDirectory(view: DataView): { entries: number; offset: number } | null {
  const minimum = Math.max(0, view.byteLength - ZIP_MIN_EOCD_BYTES - ZIP_MAX_COMMENT_BYTES);
  for (let offset = view.byteLength - ZIP_MIN_EOCD_BYTES; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) !== ZIP_EOCD_SIGNATURE) continue;
    return {
      entries: view.getUint16(offset + 10, true),
      offset: view.getUint32(offset + 16, true),
    };
  }
  return null;
}

function decodeZipName(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replaceAll("\\", "/");
}

function inspectDocx(bytes: Uint8Array, tier: AiPlanTier): HardenedFileResult {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return {
      ok: false,
      code: "FILE_SIGNATURE_MISMATCH",
      message: "Nội dung tệp không phải tài liệu DOCX hợp lệ.",
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const directory = findZipDirectory(view);
  if (!directory) {
    return {
      ok: false,
      code: "DOCX_INVALID_ARCHIVE",
      message: "Cấu trúc tệp DOCX không hợp lệ.",
    };
  }

  const limits = DOCUMENT_ARCHIVE_LIMITS[tier];
  if (directory.entries <= 0 || directory.entries > limits.entries) {
    return {
      ok: false,
      code: "DOCX_ARCHIVE_LIMIT",
      message: "Tệp DOCX có cấu trúc quá phức tạp để xử lý an toàn.",
    };
  }

  let offset = directory.offset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let hasContentTypes = false;
  let hasDocument = false;

  for (let index = 0; index < directory.entries; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
      return {
        ok: false,
        code: "DOCX_INVALID_ARCHIVE",
        message: "Cấu trúc tệp DOCX không hợp lệ.",
      };
    }

    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > view.byteLength) {
      return {
        ok: false,
        code: "DOCX_INVALID_ARCHIVE",
        message: "Cấu trúc tệp DOCX không hợp lệ.",
      };
    }

    const name = decodeZipName(bytes.subarray(nameStart, nameEnd)).toLowerCase();
    if (name === "[content_types].xml") hasContentTypes = true;
    if (name === "word/document.xml") hasDocument = true;
    if (name.endsWith("vbaproject.bin") || name.startsWith("word/embeddings/")) {
      return {
        ok: false,
        code: "DOCX_UNSAFE_CONTENT",
        message: "Tệp DOCX chứa macro hoặc đối tượng nhúng không được hỗ trợ.",
      };
    }

    totalCompressed += compressed;
    totalUncompressed += uncompressed;
    if (
      totalUncompressed > limits.uncompressedBytes ||
      (totalCompressed > 0 && totalUncompressed / totalCompressed > limits.compressionRatio)
    ) {
      return {
        ok: false,
        code: "DOCX_ARCHIVE_LIMIT",
        message: "Tệp DOCX vượt giới hạn giải nén an toàn.",
      };
    }
    offset = nameEnd + extraLength + commentLength;
  }

  if (!hasContentTypes || !hasDocument) {
    return {
      ok: false,
      code: "DOCX_INVALID_ARCHIVE",
      message: "Tệp ZIP này không phải tài liệu DOCX hợp lệ.",
    };
  }
  return { ok: true };
}

function inspectPdf(bytes: Uint8Array, tier: AiPlanTier): HardenedFileResult {
  if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return {
      ok: false,
      code: "FILE_SIGNATURE_MISMATCH",
      message: "Nội dung tệp không phải tài liệu PDF hợp lệ.",
    };
  }

  const sample = new TextDecoder("latin1").decode(bytes);
  const objectCount = sample.match(/(?:^|\s)\d+\s+\d+\s+obj(?:\s|$)/g)?.length ?? 0;
  if (objectCount > PDF_OBJECT_LIMITS[tier]) {
    return {
      ok: false,
      code: "PDF_OBJECT_LIMIT",
      message: "PDF có cấu trúc quá phức tạp để xử lý an toàn.",
    };
  }
  return { ok: true };
}

/** Validates content signatures and bounded container structure before parser allocation. */
export function inspectDocumentBytes(
  buffer: ArrayBuffer,
  sourceType: DocumentSource,
  tier: AiPlanTier,
): HardenedFileResult {
  const bytes = new Uint8Array(buffer);
  return sourceType === "docx" ? inspectDocx(bytes, tier) : inspectPdf(bytes, tier);
}
