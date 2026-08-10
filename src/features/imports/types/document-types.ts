export type ExtractedDocumentBlock =
  | {
      type: "heading";
      text: string;
      level: number;
      page?: number;
    }
  | {
      type: "paragraph";
      text: string;
      page?: number;
    }
  | {
      type: "table";
      rows: string[][];
      page?: number;
    };

export type ExtractedDocument = {
  sourceType: "docx" | "pdf";
  title?: string;
  blocks: ExtractedDocumentBlock[];
  totalCharacters: number;
  pageCount?: number;
  extractedPageCount?: number;
  pagesWithoutText?: number;
};
