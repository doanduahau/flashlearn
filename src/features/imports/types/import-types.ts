export type DraftFlashcard = {
  front: string;
  back: string;
  sourceRow?: number;
};

export type ParsedSheet = {
  name: string;
  rows: string[][];
};

export type ImportSummary = {
  valid: number;
  blank: number;
  partial: number;
  duplicate: number;
  rows: DraftFlashcard[];
};

export type ImportSource = "excel" | "paste" | "google_sheets" | "word" | "pdf";

export type PasteAnalysisResult =
  | {
      kind: "structured";
      cards: DraftFlashcard[];
    }
  | {
      kind: "semantic_required";
      text: string;
    };

export interface FlashcardGenerationProvider {
  generateCards(input: { text: string }): Promise<DraftFlashcard[]>;
}
