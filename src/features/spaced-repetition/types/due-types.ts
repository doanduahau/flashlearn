export type FsrsDueScope =
  | { type: "library" }
  | { type: "set"; setId: string }
  | { type: "collection"; collectionId: string };

/**
 * A CapyStudy-owned FSRS due candidate. Only the fields a future Smart Review
 * cutover actually needs are exposed — no raw schedule rows, no stability or
 * difficulty, and no retrievability.
 */
export type FsrsDueCandidate = {
  flashcardId: string;
  due: string;
  lastReview: string | null;
  state: number;
};

export type FsrsDueCandidateResult = {
  total: number;
  candidates: FsrsDueCandidate[];
};
