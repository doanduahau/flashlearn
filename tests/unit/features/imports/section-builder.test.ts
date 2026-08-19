import { describe, expect, it } from "vitest";

import { buildSections } from "@/features/imports/utils/section-builder";
import type { ExtractedDocumentBlock } from "@/features/imports/types/document-types";

function h(text: string, level = 1): ExtractedDocumentBlock {
  return { type: "heading", text, level };
}

function p(text: string): ExtractedDocumentBlock {
  return { type: "paragraph", text };
}

function t(rows: string[][]): ExtractedDocumentBlock {
  return { type: "table", rows };
}

describe("buildSections", () => {
  it("groups content under headings", () => {
    const sections = buildSections([
      h("Chapter 1"),
      p("Some text."),
      p("More text."),
      h("Chapter 2"),
      p("Ch2 text."),
    ]);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.heading).toBe("Chapter 1");
    expect(sections[0]?.blocks).toHaveLength(2);
    expect(sections[1]?.heading).toBe("Chapter 2");
    expect(sections[1]?.blocks).toHaveLength(1);
  });

  it("preserves content before first heading", () => {
    const sections = buildSections([p("Pre-text."), h("Chapter 1"), p("Body.")]);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.heading).toBeUndefined();
    expect(sections[0]?.blocks).toHaveLength(1);
    expect((sections[0]?.blocks[0] as { text: string }).text).toBe("Pre-text.");
  });

  it("tables stay in current section", () => {
    const sections = buildSections([
      h("Glossary"),
      t([
        ["Term", "Def"],
        ["CPU", "Central"],
      ]),
      p("See above."),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.blocks).toHaveLength(2);
    expect(sections[0]?.blocks[0]?.type).toBe("table");
    expect(sections[0]?.blocks[1]?.type).toBe("paragraph");
  });

  it("preserves source order", () => {
    const blocks: ExtractedDocumentBlock[] = [
      h("H1"),
      p("P1"),
      t([["Q", "A"]]),
      p("P2"),
      h("H2"),
      t([["T", "D"]]),
    ];
    const sections = buildSections(blocks);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.blocks).toHaveLength(3);
    expect(sections[1]?.blocks).toHaveLength(1);
  });

  it("skips empty / whitespace-only content", () => {
    const sections = buildSections([h("H"), p("   "), p("Real")]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.blocks).toHaveLength(1);
  });

  it("returns empty array for no content", () => {
    const sections = buildSections([]);
    expect(sections).toHaveLength(0);
  });

  it("does not create excessive sections", () => {
    const sections = buildSections([p("A"), p("B"), p("C")]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.blocks).toHaveLength(3);
  });
});
