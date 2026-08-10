import { StartNewCardsButton } from "@/features/spaced-repetition/components/start-new-cards-button";

export function NewCardsContinuation({ remainingCount }: { remainingCount: number }) {
  return (
    <section
      aria-label="Tiếp tục học thẻ mới"
      className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-subtle p-4"
    >
      {remainingCount > 0 ? (
        <>
          <p className="font-semibold">Còn {remainingCount} thẻ chưa học</p>
          <StartNewCardsButton label="Học tiếp" />
        </>
      ) : (
        <p className="font-semibold text-primary-foreground">Đã học hết thẻ mới</p>
      )}
    </section>
  );
}
