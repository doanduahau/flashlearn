export const sourceTypes = ["all", "regular", "special"] as const;

export type SourceType = (typeof sourceTypes)[number];
export type SourceKind = Exclude<SourceType, "all">;

export type SourceOption = {
  id: string;
  kind: SourceKind;
  name: string;
  cardCount: number;
};

export type SourcePage = {
  sources: SourceOption[];
  page: number;
  totalPages: number;
  query: string;
  type: SourceType;
};
