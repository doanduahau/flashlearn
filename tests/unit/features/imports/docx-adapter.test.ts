import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("mammoth", () => ({
  default: {
    convertToHtml: vi.fn(),
  },
}));

import mammoth from "mammoth";
import { extractDocx } from "@/features/imports/adapters/docx-adapter";

afterEach(() => {
  vi.clearAllMocks();
});

describe("extractDocx", () => {
  it("extracts headings, paragraphs, and tables in document order", async () => {
    vi.mocked(mammoth.convertToHtml).mockResolvedValue({
      value: `<html><body>
        <h1>Chương 1</h1>
        <p>Hệ điều hành là phần mềm quản lý tài nguyên.</p>
        <table><tr><td>Câu hỏi</td><td>Trả lời</td></tr><tr><td>OS là gì?</td><td>Hệ điều hành</td></tr></table>
        <p>FCFS phục vụ các tiến trình theo thứ tự đến.</p>
      </body></html>`,
      messages: [],
    });

    const buf = new ArrayBuffer(100);
    const result = await extractDocx(buf);

    expect(result.sourceType).toBe("docx");
    expect(result.blocks).toHaveLength(4);

    expect(result.blocks[0]?.type).toBe("heading");
    expect((result.blocks[0] as { text: string }).text).toBe("Chương 1");

    expect(result.blocks[1]?.type).toBe("paragraph");
    expect((result.blocks[1] as { text: string }).text).toContain("Hệ điều hành");

    expect(result.blocks[2]?.type).toBe("table");
    const table = result.blocks[2] as Extract<(typeof result.blocks)[2], { type: "table" }>;
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]?.[0]).toBe("OS là gì?");

    expect(result.blocks[3]?.type).toBe("paragraph");
    expect((result.blocks[3] as { text: string }).text).toContain("FCFS");
  });

  it("preserves Vietnamese Unicode", async () => {
    vi.mocked(mammoth.convertToHtml).mockResolvedValue({
      value: `<html><body><h1>Tiếng Việt</h1><p>Xin chào các bạn</p></body></html>`,
      messages: [],
    });

    const result = await extractDocx(new ArrayBuffer(100));
    expect(result.blocks).toHaveLength(2);
    expect((result.blocks[0] as { text: string }).text).toBe("Tiếng Việt");
    expect((result.blocks[1] as { text: string }).text).toBe("Xin chào các bạn");
  });

  it("skips empty paragraphs", async () => {
    vi.mocked(mammoth.convertToHtml).mockResolvedValue({
      value: `<html><body><p>Valid</p><p>    </p><p>Also valid</p></body></html>`,
      messages: [],
    });

    const result = await extractDocx(new ArrayBuffer(100));
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.every((b) => b.type === "paragraph")).toBe(true);
  });

  it("handles heading levels h1 through h6", async () => {
    vi.mocked(mammoth.convertToHtml).mockResolvedValue({
      value: `<html><body><h2>Level 2</h2><h6>Level 6</h6></body></html>`,
      messages: [],
    });

    const result = await extractDocx(new ArrayBuffer(100));
    expect(result.blocks).toHaveLength(2);
    const h2 = result.blocks[0] as Extract<(typeof result.blocks)[0], { level: number }>;
    const h6 = result.blocks[1] as Extract<(typeof result.blocks)[1], { level: number }>;
    expect(h2.level).toBe(2);
    expect(h6.level).toBe(6);
  });

  it("returns empty blocks for empty document", async () => {
    vi.mocked(mammoth.convertToHtml).mockResolvedValue({
      value: `<html><body></body></html>`,
      messages: [],
    });

    const result = await extractDocx(new ArrayBuffer(100));
    expect(result.blocks).toHaveLength(0);
    expect(result.totalCharacters).toBe(0);
  });
});
