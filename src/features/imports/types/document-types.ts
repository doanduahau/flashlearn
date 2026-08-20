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
  processingJob?: {
    id: string;
    correlationId: string;
  };
};

export type SectionKind = "flashcard_like" | "prose" | "mixed" | "empty";

export type DetectionMethod = "deterministic" | "ai";

export type AnalyzedDocumentSection = {
  index: number;
  heading?: string;
  blocks: ExtractedDocumentBlock[];
  kind: SectionKind;
  confidence: number;
  detectedBy: DetectionMethod;
  reason?: string;
};

export type AnalyzedDocument = {
  sourceType: "docx" | "pdf";
  title?: string;
  sections: AnalyzedDocumentSection[];
  totalCharacters: number;
  analysis: {
    deterministicSections: number;
    aiSections: number;
    sourceChars: number;
    aiInputChars: number;
  };
  processingJob?: {
    id: string;
    correlationId: string;
  };
  warnings?: string[];
};
