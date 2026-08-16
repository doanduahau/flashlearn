import { describe, expect, it, vi } from "vitest";

import { loadMergedHistory } from "@/features/statistics/server/load-statistics";

describe("loadMergedHistory", () => {
  it("merges quiz_sessions, match_attempts, and typing_attempts sorted by completed_at desc", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "quiz_sessions") {
          return {
            select: () => ({
              not: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "quiz-1",
                          actual_question_count: 10,
                          correct_answer_count: 8,
                          completed_at: "2026-08-16T12:00:00Z",
                        },
                      ],
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "match_attempts") {
          return {
            select: () => ({
              not: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "match-1",
                          total_pairs: 12,
                          correct_pair_count: 12,
                          completed_at: "2026-08-16T14:00:00Z",
                        },
                      ],
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "typing_attempts") {
          return {
            select: () => ({
              not: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "typing-1",
                          total_questions: 15,
                          correct_questions: 14,
                          completed_at: "2026-08-16T10:00:00Z",
                        },
                      ],
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            not: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [] }),
              }),
            }),
          }),
        };
      }),
    } as unknown as Parameters<typeof loadMergedHistory>[0];

    const history = await loadMergedHistory(supabase);

    expect(history).toHaveLength(3);
    expect(history[0]).toEqual({
      id: "match-1",
      type: "match",
      correct: 12,
      total: 12,
      completedAt: "2026-08-16T14:00:00Z",
    });
    expect(history[1]).toEqual({
      id: "quiz-1",
      type: "quiz",
      correct: 8,
      total: 10,
      completedAt: "2026-08-16T12:00:00Z",
    });
    expect(history[2]).toEqual({
      id: "typing-1",
      type: "typing",
      correct: 14,
      total: 15,
      completedAt: "2026-08-16T10:00:00Z",
    });
  });
});
