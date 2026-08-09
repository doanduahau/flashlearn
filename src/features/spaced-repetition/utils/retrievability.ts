import { forgetting_curve } from "ts-fsrs";

import { FLASHLEARN_V1_W } from "../config";

export function computeRetrievability(stability: number, elapsedDays: number): number {
  return forgetting_curve(FLASHLEARN_V1_W, elapsedDays, stability);
}
