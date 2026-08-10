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
