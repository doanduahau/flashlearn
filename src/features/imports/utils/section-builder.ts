import type { ExtractedDocumentBlock } from "../types/document-types";

export type BuiltSection = {
  heading?: string;
  blocks: ExtractedDocumentBlock[];
};

function isMeaningful(block: ExtractedDocumentBlock): boolean {
  if (block.type === "heading") return block.text.trim().length > 0;
  if (block.type === "paragraph") return block.text.trim().length > 0;
  if (block.type === "table") {
    return block.rows.some((row) => row.some((cell) => cell.trim().length > 0));
  }
  return false;
}

function blockTextLength(block: ExtractedDocumentBlock): number {
  if (block.type === "heading" || block.type === "paragraph") return block.text.length;
  if (block.type === "table") {
    return block.rows.reduce((sum, row) => sum + row.reduce((s, c) => s + c.length, 0), 0);
  }
  return 0;
}

export function buildSections(blocks: ExtractedDocumentBlock[]): BuiltSection[] {
  const meaningful = blocks.filter(isMeaningful);
  if (meaningful.length === 0) return [];

  const sections: BuiltSection[] = [];
  let current: BuiltSection | null = null;

  for (const block of meaningful) {
    if (block.type === "heading") {
      if (current) sections.push(current);
      current = { heading: block.text, blocks: [] };
    } else if (current) {
      current.blocks.push(block);
    } else {
      // Content before first heading: start a section without a heading.
      current = { blocks: [block] };
    }
  }

  if (current) sections.push(current);

  const hasMeaningfulContent = (s: BuiltSection) =>
    s.blocks.some((b) => blockTextLength(b) > 0) || (s.heading?.length ?? 0) > 0;

  return sections.filter((s) => s.heading || hasMeaningfulContent(s));
}
