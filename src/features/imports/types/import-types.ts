export type ImportRow = { front: string; back: string };

export type ParsedSheet = {
  name: string;
  rows: string[][];
};

export type ImportSummary = {
  valid: number;
  blank: number;
  partial: number;
  duplicate: number;
  rows: ImportRow[];
};
