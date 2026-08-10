import mammoth from "mammoth";

import type { ExtractedDocument, ExtractedDocumentBlock } from "../types/document-types";
import { DOCUMENT_MAX_EXTRACTED_CHARS } from "@/lib/constants";

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTableBlock(html: string): string[][] {
  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const row: string[] = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1]!)) !== null) {
      row.push(stripHtmlTags(tdMatch[1]!));
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

const BLOCK_TAG_RE = /<(h[1-6]|p|table)\b[\s\S]*?>/gi;

function parseMammothHtml(html: string): { blocks: ExtractedDocumentBlock[]; chars: number } {
  const blocks: ExtractedDocumentBlock[] = [];
  let totalChars = 0;

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] ?? html;

  const segments: Array<{ tag: string; html: string }> = [];
  let match;

  while ((match = BLOCK_TAG_RE.exec(body)) !== null) {
    const tagName = match[1]!.toLowerCase();
    const tagStart = match.index;
    const fullOpenTag = match[0];
    const closeTag = `</${tagName}>`;

    const contentStart = tagStart + fullOpenTag.length;
    const closeIndex = findMatchingClose(body, tagName, contentStart);
    if (closeIndex === -1) continue;

    const content = body.slice(contentStart, closeIndex);
    segments.push({ tag: tagName, html: content });
  }

  for (const seg of segments) {
    if (seg.tag.startsWith("h")) {
      const level = parseInt(seg.tag.charAt(1), 10);
      const text = stripHtmlTags(seg.html);
      if (text.length === 0) continue;
      blocks.push({ type: "heading", text, level });
      totalChars += text.length;
    } else if (seg.tag === "p") {
      const text = stripHtmlTags(seg.html);
      if (text.length === 0) continue;
      blocks.push({ type: "paragraph", text });
      totalChars += text.length;
    } else if (seg.tag === "table") {
      const rows = parseTableBlock(seg.html);
      if (rows.length === 0) continue;
      blocks.push({ type: "table", rows });
      for (const row of rows) {
        for (const cell of row) totalChars += cell.length;
      }
    }
  }

  return { blocks, chars: totalChars };
}

function findMatchingClose(html: string, tagName: string, startFrom: number): number {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let depth = 1;
  let pos = startFrom;
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf(openTag, pos);
    const nextClose = html.indexOf(closeTag, pos);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + openTag.length;
    } else {
      depth -= 1;
      pos = nextClose + closeTag.length;
    }
  }
  return depth === 0 ? pos - closeTag.length : -1;
}

export async function extractDocx(fileBuffer: ArrayBuffer): Promise<ExtractedDocument> {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(fileBuffer) });
  const parsed = parseMammothHtml(result.value);
  const blocks =
    parsed.chars > DOCUMENT_MAX_EXTRACTED_CHARS
      ? parsed.blocks.slice(
          0,
          Math.max(
            1,
            Math.floor((DOCUMENT_MAX_EXTRACTED_CHARS / parsed.chars) * parsed.blocks.length),
          ),
        )
      : parsed.blocks;

  return {
    sourceType: "docx",
    blocks,
    totalCharacters: Math.min(parsed.chars, DOCUMENT_MAX_EXTRACTED_CHARS),
  };
}
