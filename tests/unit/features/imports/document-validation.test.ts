import { describe, expect, it } from "vitest";

import { validateDocumentFile } from "@/features/imports/utils/document-validation";

describe("validateDocumentFile", () => {
  it("accepts .docx with correct MIME", () => {
    const result = validateDocumentFile({
      name: "test.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sourceType).toBe("docx");
  });

  it("accepts .pdf with correct MIME", () => {
    const result = validateDocumentFile({
      name: "test.pdf",
      type: "application/pdf",
      size: 1000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sourceType).toBe("pdf");
  });

  it("accepts .docx without MIME (extension is enough)", () => {
    const result = validateDocumentFile({
      name: "document.docx",
      type: "",
      size: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects .doc with clear message", () => {
    const result = validateDocumentFile({
      name: "old.doc",
      type: "application/msword",
      size: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(".docx");
  });

  it("rejects .rtf", () => {
    const result = validateDocumentFile({
      name: "test.rtf",
      type: "",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported extensions", () => {
    const result = validateDocumentFile({
      name: "file.txt",
      type: "text/plain",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects .docx extension with PDF MIME (mismatch)", () => {
    const result = validateDocumentFile({
      name: "test.pdf",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects files without extension", () => {
    const result = validateDocumentFile({
      name: "noext",
      type: "",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });
});
