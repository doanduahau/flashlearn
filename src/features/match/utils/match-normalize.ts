import { normalizeContentText } from "@/lib/normalize-content";

/**
 * Canonical normalization for Match ambiguity detection. Re-exports the shared
 * learning-mode normalization so Match, Memory, and Quiz all use one definition.
 */
export const normalizeMatchText = normalizeContentText;

export function uniqueFrontKeys(cards: readonly { front: string }[]): Set<string> {
  return new Set(cards.map((card) => normalizeContentText(card.front)));
}

export function uniqueBackKeys(cards: readonly { back: string }[]): Set<string> {
  return new Set(cards.map((card) => normalizeContentText(card.back)));
}
