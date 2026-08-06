"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QUIZ_MIN_QUESTIONS, type QuizMode } from "@/features/quiz/schemas/quiz-schema";
import { startQuiz } from "@/features/quiz/server/actions";

export interface QuizSource {
  id: string;
  name: string;
  cardCount: number;
}
const modes: Array<{ id: QuizMode; title: string; description: string }> = [
  {
    id: "balanced",
    title: "Cân bằng",
    description: "Ưu tiên thẻ mới, ít lặp lại và thường trả lời sai.",
  },
  {
    id: "never_tested",
    title: "Chưa kiểm tra",
    description: "Ưu tiên thẻ chưa từng xuất hiện, rồi dùng quy tắc cân bằng.",
  },
  {
    id: "wrong_answers",
    title: "Câu sai",
    description: "Ưu tiên các thẻ bạn đã trả lời sai, rồi dùng quy tắc cân bằng.",
  },
  {
    id: "pure_random",
    title: "Ngẫu nhiên",
    description: "Chọn ngẫu nhiên các thẻ duy nhất trong phạm vi.",
  },
];

export function QuizSetup({
  sets,
  collections,
  totalCards,
}: {
  sets: QuizSource[];
  collections: QuizSource[];
  totalCards: number;
}) {
  const router = useRouter();
  const [all, setAll] = useState(true);
  const [setIds, setSetIds] = useState<string[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [mode, setMode] = useState<QuizMode>("balanced");
  const [count, setCount] = useState(QUIZ_MIN_QUESTIONS);
  const [error, setError] = useState<string | null>(null);
  const [pending, transition] = useTransition();
  const eligible = all
    ? totalCards
    : new Set([...setIds, ...collectionIds]).size === 0
      ? 0
      : Math.min(
          totalCards,
          sets.filter((x) => setIds.includes(x.id)).reduce((n, x) => n + x.cardCount, 0) +
            collections
              .filter((x) => collectionIds.includes(x.id))
              .reduce((n, x) => n + x.cardCount, 0),
        );
  const toggle = (id: string, current: string[], update: (ids: string[]) => void) => {
    setAll(false);
    update(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };
  const submit = () =>
    transition(async () => {
      setError(null);
      const result = await startQuiz({ all, setIds, collectionIds, mode, questionCount: count });
      if (!result.ok || !result.sessionId) {
        setError(result.ok ? "Không thể tạo bài kiểm tra." : result.error);
        return;
      }
      router.push(`/quiz/${result.sessionId}`);
    });
  return (
    <div className="mt-6 space-y-6">
      <label className="flex gap-3 rounded-2xl border border-border-soft p-4">
        <input type="radio" checked={all} onChange={() => setAll(true)} />{" "}
        <span>
          <strong>Tất cả thẻ</strong>
          <br />
          <span className="text-sm text-text-secondary">{totalCards} thẻ duy nhất</span>
        </span>
      </label>
      <section aria-label="Bộ flashcard">
        <h2 className="font-semibold">Bộ flashcard</h2>
        {sets.map((source) => (
          <label
            className="mt-2 flex gap-3 rounded-xl border border-border-soft p-3"
            key={source.id}
          >
            <input
              type="checkbox"
              checked={setIds.includes(source.id)}
              onChange={() => toggle(source.id, setIds, setSetIds)}
            />
            <span>
              {source.name}{" "}
              <span className="text-sm text-text-secondary">({source.cardCount})</span>
            </span>
          </label>
        ))}
      </section>
      <section aria-label="Bộ đặc biệt">
        <h2 className="font-semibold">Bộ đặc biệt</h2>
        {collections.map((source) => (
          <label
            className="mt-2 flex gap-3 rounded-xl border border-border-soft p-3"
            key={source.id}
          >
            <input
              type="checkbox"
              checked={collectionIds.includes(source.id)}
              onChange={() => toggle(source.id, collectionIds, setCollectionIds)}
            />
            <span>
              {source.name}{" "}
              <span className="text-sm text-text-secondary">({source.cardCount})</span>
            </span>
          </label>
        ))}
      </section>
      <fieldset>
        <legend className="font-semibold">Chế độ tạo đề</legend>
        {modes.map((item) => (
          <label className="mt-2 flex gap-3 rounded-xl border border-border-soft p-3" key={item.id}>
            <input
              type="radio"
              name="quiz-mode"
              checked={mode === item.id}
              onChange={() => setMode(item.id)}
            />
            <span>
              <strong>{item.title}</strong>
              <br />
              <span className="text-sm text-text-secondary">{item.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="block font-semibold" htmlFor="question-count">
        Số câu hỏi{" "}
        <input
          id="question-count"
          className="ml-3 rounded border p-2"
          type="number"
          min={QUIZ_MIN_QUESTIONS}
          max={Math.min(eligible, 100)}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
        />
      </label>
      <p aria-live="polite" className="text-text-secondary">
        Có {eligible} thẻ trong phạm vi. Cần ít nhất {QUIZ_MIN_QUESTIONS} thẻ.
      </p>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={submit}
        disabled={
          pending || eligible < QUIZ_MIN_QUESTIONS || count < QUIZ_MIN_QUESTIONS || count > eligible
        }
      >
        {pending ? "Đang tạo…" : "Bắt đầu kiểm tra"}
      </Button>
    </div>
  );
}
