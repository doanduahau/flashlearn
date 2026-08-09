import { StartSmartReviewButton } from "@/features/smart-review/components/start-smart-review-button";

export function SmartReviewContinuation({ remainingCount }: { remainingCount: number }) {
  return (
    <section
      aria-label="Tiếp tục ôn thông minh"
      className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-subtle p-4"
    >
      {remainingCount > 0 ? (
        <>
          <p className="font-semibold">Còn {remainingCount} thẻ cần ôn</p>
          <StartSmartReviewButton label="Ôn tiếp" />
        </>
      ) : (
        <p className="font-semibold text-primary-foreground">Đã ôn xong hôm nay</p>
      )}
    </section>
  );
}
