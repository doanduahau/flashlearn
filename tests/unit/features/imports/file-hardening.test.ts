import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { inspectDocumentBytes } from "@/features/imports/utils/file-hardening";

async function docx(extra?: (zip: JSZip) => void): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types />");
  zip.file("word/document.xml", "<document />");
  extra?.(zip);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

describe("document byte hardening", () => {
  it("rejects a renamed non-PDF by magic bytes", () => {
    const bytes = new TextEncoder().encode("not a pdf").buffer;
    expect(inspectDocumentBytes(bytes, "pdf", "free")).toMatchObject({
      ok: false,
      code: "FILE_SIGNATURE_MISMATCH",
    });
  });

  it("accepts the required bounded DOCX container entries", async () => {
    expect(inspectDocumentBytes(await docx(), "docx", "free")).toEqual({ ok: true });
  });

  it("rejects DOCX macros and embedded objects", async () => {
    const result = inspectDocumentBytes(
      await docx((zip) => zip.file("word/vbaProject.bin", "macro")),
      "docx",
      "free",
    );
    expect(result).toMatchObject({ ok: false, code: "DOCX_UNSAFE_CONTENT" });
  });

  it("rejects a high-ratio DOCX payload before parser allocation", async () => {
    const result = inspectDocumentBytes(
      await docx((zip) => zip.file("word/large.xml", "0".repeat(2_000_000))),
      "docx",
      "free",
    );
    expect(result).toMatchObject({ ok: false, code: "DOCX_ARCHIVE_LIMIT" });
  });

  it("accepts a bounded PDF signature", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF").buffer;
    expect(inspectDocumentBytes(bytes, "pdf", "free")).toEqual({ ok: true });
  });
});
