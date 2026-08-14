import { learningFilters, type LearningFilter } from "@/features/learning-modes/types";
import {
  RUNNER_QUESTION_COUNTS,
  type RunnerDifficulty,
  type RunnerQuestionCount,
  type RunnerReplaySource,
} from "../types/runner-types";

type RunnerSessionSearchParams = Record<string, string | string[] | undefined>;

const RUNNER_DIFFICULTIES: readonly RunnerDifficulty[] = ["easy", "medium", "hard"];

function valueOf(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function parseIds(value: string | null): string[] | null {
  if (value === null || value.length === 0) return [];
  const ids = value.split(",");
  if (
    ids.some(
      (id) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    )
  ) {
    return null;
  }
  return [...new Set(ids)];
}

export function parseRunnerReplaySource(
  searchParams: RunnerSessionSearchParams,
): RunnerReplaySource | null {
  const all = valueOf(searchParams.all) === "1";
  const setIds = parseIds(valueOf(searchParams.sets));
  const collectionIds = parseIds(valueOf(searchParams.collections));
  const count = Number(valueOf(searchParams.count));
  const filter = valueOf(searchParams.filter);
  const difficulty = valueOf(searchParams.difficulty);

  if (
    setIds === null ||
    collectionIds === null ||
    !RUNNER_QUESTION_COUNTS.includes(count as RunnerQuestionCount) ||
    !learningFilters.includes(filter as LearningFilter) ||
    !RUNNER_DIFFICULTIES.includes(difficulty as RunnerDifficulty)
  ) {
    return null;
  }

  const hasSets = setIds.length > 0;
  const hasCollections = collectionIds.length > 0;
  if ((all && (hasSets || hasCollections)) || (!all && hasSets === hasCollections)) {
    return null;
  }

  return {
    all,
    setIds,
    collectionIds,
    questionCount: count as RunnerQuestionCount,
    filter: filter as LearningFilter,
    difficulty: difficulty as RunnerDifficulty,
  };
}

export function buildRunnerSessionHref(
  runnerSessionId: string,
  source: RunnerReplaySource,
): string {
  const params = new URLSearchParams({
    sessionId: runnerSessionId,
    count: String(source.questionCount),
    filter: source.filter,
    difficulty: source.difficulty,
  });

  if (source.all) params.set("all", "1");
  else if (source.setIds.length > 0) params.set("sets", source.setIds.join(","));
  else params.set("collections", source.collectionIds.join(","));

  return `/runner/session?${params.toString()}`;
}
