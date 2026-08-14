import { forgetting_curve } from "ts-fsrs";

import { CAPYSTUDY_V1_W } from "../config";

export function computeRetrievability(stability: number, elapsedDays: number): number {
  return forgetting_curve(CAPYSTUDY_V1_W, elapsedDays, stability);
}
