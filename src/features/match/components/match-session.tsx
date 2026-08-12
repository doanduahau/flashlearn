"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MatchBoard } from "@/features/match/components/match-board";
import { loadMatchCards } from "@/features/match/server/actions";
import type { MatchCard, MatchQuestionCount } from "@/features/match/types/match-types";
import { buildMatchSession } from "@/features/match/utils/match-session";

type MatchSessionProps = {
  sessionHref: string;
  questionCount: MatchQuestionCount;
};

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function MatchSession({ sessionHref, questionCount }: MatchSessionProps) {
  const [cards, setCards] = useState<MatchCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const [done, setDone] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = true;
    let cancelled = false;
    const url = new URL(sessionHref, window.location.origin);
    const all = url.searchParams.get("all") === "1";
    const setIds = (url.searchParams.get("sets") ?? "").split(",").filter(Boolean);
    const collectionIds = (url.searchParams.get("collections") ?? "").split(",").filter(Boolean);
    void (async () => {
      const result = await loadMatchCards({ all, setIds, collectionIds, questionCount });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCards(result.cards);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionHref, questionCount]);

  const batches = useMemo(() => {
    if (!cards) return null;
    const random = mulberry32(sessionKey);
    return buildMatchSession(cards, questionCount, random);
  }, [cards, questionCount, sessionKey]);

  function replay(): void {
    setDone(false);
    setSessionKey(Math.floor(Math.random() * 2 ** 32));
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/study">Quay lại</Link>
        </Button>
      </div>
    );
  }

  if (!cards) {
    return (
      <p role="status" className="text-text-secondary">
        Đang tải thẻ…
      </p>
    );
  }

  if (!batches) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tạo phiên Match với số thẻ hiện tại. Hãy chọn phạm vi khác.
        </p>
        <Button asChild variant="outline">
          <Link href="/match">Quay lại</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold sm:text-2xl">
          Hoàn thành {questionCount}/{questionCount}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={replay}>
            Chơi lại
          </Button>
          <Button asChild variant="outline">
            <Link href="/study">Quay lại</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MatchBoard
      key={sessionKey}
      batches={batches}
      questionCount={questionCount}
      onComplete={() => setDone(true)}
    />
  );
}
