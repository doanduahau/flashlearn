const SUPPORTED_EXTENSIONS = new Set([".docx", ".pdf"]);
const UNSUPPORTED_VARIANTS = new Set([".doc", ".rtf", ".odt"]);

const MIME_TO_TYPE: Record<string, "docx" | "pdf" | null> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/pdf": "pdf",
};

export type ValidationResult =
  { ok: true; sourceType: "docx" | "pdf" } | { ok: false; error: string };

export function validateDocumentFile(file: {
  name: string;
  type: string;
  size: number;
}): ValidationResult {
  const lower = file.name.toLowerCase();

  const extDot = lower.lastIndexOf(".");
  if (extDot === -1) return { ok: false, error: "Không nhận diện được định dạng tệp." };

  const ext = lower.slice(extDot);

  if (UNSUPPORTED_VARIANTS.has(ext)) {
    if (ext === ".doc")
      return { ok: false, error: "Không hỗ trợ định dạng .doc. Vui lòng dùng .docx." };
    return { ok: false, error: "Định dạng tệp không được hỗ trợ." };
  }

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Chỉ hỗ trợ tệp .docx và .pdf." };
  }

  const byMime = MIME_TO_TYPE[file.type];
  if (file.type && byMime === undefined) {
    return { ok: false, error: "Loại nội dung của tệp không được hỗ trợ." };
  }
  if (byMime && !SUPPORTED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Định dạng tệp không khớp." };
  }

  if (byMime && byMime === "docx" && ext !== ".docx") {
    return { ok: false, error: "Định dạng tệp không khớp." };
  }
  if (byMime && byMime === "pdf" && ext !== ".pdf") {
    return { ok: false, error: "Định dạng tệp không khớp." };
  }

  const sourceType = ext === ".docx" ? "docx" : "pdf";
  return { ok: true, sourceType };
}
