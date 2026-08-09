import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { quizRating, ratingForReviewFact } from "@/features/spaced-repetition/utils/rating-map";

describe("quizRating", () => {
  it("maps incorrect to Again", () => {
    expect(quizRating(false)).toBe(Rating.Again);
  });

  it("maps correct to Good", () => {
    expect(quizRating(true)).toBe(Rating.Good);
  });
});

describe("ratingForReviewFact", () => {
  it("skips null correctness with no stored rating", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: null,
      }),
    ).toBeNull();
  });

  it("maps historical true to Good", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: true,
      }),
    ).toBe(Rating.Good);
  });

  it("maps historical false to Again", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: false,
      }),
    ).toBe(Rating.Again);
  });

  it("uses a stored rating over the historical binary fallback", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: false,
        fsrsRating: Rating.Good,
      }),
    ).toBe(Rating.Good);
    expect(
      ratingForReviewFact({
        eventId: "e2",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: true,
        fsrsRating: Rating.Again,
      }),
    ).toBe(Rating.Again);
  });

  it("preserves Hard and Easy when stored", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: null,
        fsrsRating: Rating.Hard,
      }),
    ).toBe(Rating.Hard);
    expect(
      ratingForReviewFact({
        eventId: "e2",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: null,
        fsrsRating: Rating.Easy,
      }),
    ).toBe(Rating.Easy);
  });

  it("falls back to binary history for an invalid stored rating", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: true,
        fsrsRating: Rating.Manual,
      }),
    ).toBe(Rating.Good);
    expect(
      ratingForReviewFact({
        eventId: "e2",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: false,
        fsrsRating: 99,
      }),
    ).toBe(Rating.Again);
  });

  it("never maps null correctness to Again", () => {
    expect(
      ratingForReviewFact({
        eventId: "e1",
        reviewedAt: "2026-08-09T12:00:00.000Z",
        isCorrect: null,
      }),
    ).not.toBe(Rating.Again);
  });
});
