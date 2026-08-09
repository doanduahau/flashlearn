import { fsrs, type FSRS } from "ts-fsrs";

import { FSR_SCHEDULER_IDENTITY } from "./types/spaced-repetition-types";

/**
 * FlashLearn Spaced Repetition — frozen scheduler configuration.
 *
 * Identity: fsrs-6 / ts-fsrs@5.4.1 / flashlearn-v1
 *
 * INVARIANT — changing ANY scheduling-affecting value in this module requires
 * a NEW parameter-set identifier (flashlearn-v2 / equivalent). This includes
 * the weights array, request_retention, maximum_interval, enable_fuzz,
 * enable_short_term, learning_steps, relearning_steps, or the algorithm
 * implementation where behavior changes. flashlearn-v1 is immutable. Future
 * rebuilds depend on the exact configuration that produced existing state.
 *
 * Quiz rating mapping (see utils/rating-map.ts): incorrect -> Again, correct -> Good.
 *
 * STATUS: FSRS currently runs as pure infrastructure only. It does NOT yet
 * influence Smart Review eligibility, Dashboard counts, or Mastery UI.
 */
export const FLASHLEARN_V1_W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;

export const FLASHLEARN_V1_PARAMETERS = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"] as const,
  relearning_steps: ["10m"] as const,
  w: FLASHLEARN_V1_W,
} as const;

export function createFlashlearnScheduler(): FSRS {
  return fsrs(FLASHLEARN_V1_PARAMETERS);
}

export { FSR_SCHEDULER_IDENTITY as FLASHLEARN_SCHEDULER_IDENTITY };
