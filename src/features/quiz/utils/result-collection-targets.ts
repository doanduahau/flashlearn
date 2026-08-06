import type { CardCollectionOption } from "@/features/special-collections/components/card-collections-control";

export interface QuizResultQuestion {
  id: string;
  is_correct: boolean | null;
  flashcard_id: string | null;
}

export type QuizResultCollectionTarget =
  | {
      kind: "save";
      questionId: string;
      flashcardId: string;
      setId: string;
      collections: CardCollectionOption[];
      memberships: string[];
    }
  | { kind: "missing"; questionId: string };

export function buildQuizResultCollectionTargets(params: {
  questions: QuizResultQuestion[];
  collections: CardCollectionOption[];
  membershipsByCard: Record<string, string[]>;
  setByCard: Record<string, string>;
}): Map<string, QuizResultCollectionTarget> {
  const targets = new Map<string, QuizResultCollectionTarget>();
  for (const question of params.questions) {
    if (question.is_correct !== false) continue;
    const flashcardId = question.flashcard_id;
    if (!flashcardId) {
      targets.set(question.id, { kind: "missing", questionId: question.id });
      continue;
    }
    const setId = params.setByCard[flashcardId];
    if (!setId) {
      targets.set(question.id, { kind: "missing", questionId: question.id });
      continue;
    }
    targets.set(question.id, {
      kind: "save",
      questionId: question.id,
      flashcardId,
      setId,
      collections: params.collections,
      memberships: params.membershipsByCard[flashcardId] ?? [],
    });
  }
  return targets;
}
