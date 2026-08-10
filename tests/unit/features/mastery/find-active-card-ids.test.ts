import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";
import {
  createActiveCardLoaderTrace,
  findActiveCardIdsWithOptions,
} from "@/features/mastery/utils/find-active-card-ids";

type QueryResponse = {
  data: Array<{ id: string }> | null;
  error: { code?: string; status?: number } | null;
};

function createClient(responses: QueryResponse[]): {
  client: SupabaseClient<Database>;
  inCalls: string[][];
  rangeCalls: Array<[number, number]>;
} {
  const inCalls: string[][] = [];
  const rangeCalls: Array<[number, number]> = [];
  const builder = {
    in: vi.fn((_column: string, ids: string[]) => {
      inCalls.push([...ids]);
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      return Promise.resolve(responses.shift() ?? { data: [], error: null });
    }),
  };
  const client = {
    from: vi.fn(() => ({ select: vi.fn(() => builder) })),
  } as unknown as SupabaseClient<Database>;

  return { client, inCalls, rangeCalls };
}

describe("findActiveCardIdsWithOptions", () => {
  it("fails closed when Supabase returns data=null with an error", async () => {
    const { client } = createClient([{ data: null, error: { code: "PGRST001", status: 400 } }]);
    const trace = createActiveCardLoaderTrace();

    await expect(findActiveCardIdsWithOptions(client, ["a"], { trace })).rejects.toThrow(
      "Unable to load active flashcards for mastery",
    );
    expect(trace.batches).toEqual([
      {
        inputIdCount: 1,
        pagesRequested: 1,
        rowsReturned: 0,
        error: { code: "PGRST001", status: 400, category: "postgrest" },
      },
    ]);
  });

  it("fails closed after a partial page instead of returning incomplete active IDs", async () => {
    const { client, rangeCalls } = createClient([
      { data: [{ id: "a" }], error: null },
      { data: null, error: { code: "PGRST002", status: 500 } },
    ]);
    const trace = createActiveCardLoaderTrace();

    await expect(findActiveCardIdsWithOptions(client, ["a", "b"], { trace })).rejects.toThrow(
      "Unable to load active flashcards for mastery",
    );
    expect(rangeCalls).toEqual([
      [0, 999],
      [1, 1000],
    ]);
    expect(trace.batches[0]).toMatchObject({ pagesRequested: 2, rowsReturned: 1 });
    expect(trace.batches[0]?.error).not.toBeNull();
  });

  it("fails closed when a later IN batch errors", async () => {
    const { client, inCalls } = createClient([
      { data: [], error: null },
      { data: null, error: { code: "PGRST003", status: 413 } },
    ]);

    await expect(
      findActiveCardIdsWithOptions(client, ["a", "b", "c"], { inBatchSize: 2 }),
    ).rejects.toThrow("Unable to load active flashcards for mastery");
    expect(inCalls).toEqual([["a", "b"], ["c"]]);
  });

  it("deduplicates input, uses multiple batches, and advances the page offset by returned rows", async () => {
    const { client, inCalls, rangeCalls } = createClient([
      { data: [{ id: "a" }, { id: "b" }], error: null },
      { data: [], error: null },
      { data: [{ id: "c" }], error: null },
      { data: [], error: null },
    ]);

    await expect(
      findActiveCardIdsWithOptions(client, ["a", "b", "a", "c"], { inBatchSize: 2 }),
    ).resolves.toEqual(["a", "b", "c"]);
    expect(inCalls).toEqual([["a", "b"], ["a", "b"], ["c"], ["c"]]);
    expect(rangeCalls).toEqual([
      [0, 999],
      [2, 1001],
      [0, 999],
      [1, 1000],
    ]);
  });
});
