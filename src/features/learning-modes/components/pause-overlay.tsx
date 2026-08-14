import { Button } from "@/components/ui/button";

export function PauseOverlay({
  onResume,
}: Readonly<{
  onResume: () => void;
}>) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface/80 px-6 text-center backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Đã tạm dừng"
    >
      <p className="text-xl font-bold text-text-primary sm:text-2xl">Đã tạm dừng</p>
      <p className="mt-2 text-sm text-text-secondary sm:text-base">
        Tiến trình học đã được tạm dừng khi bạn chuyển tab.
      </p>
      <Button className="mt-8 px-8" size="lg" onClick={onResume}>
        Tiếp tục
      </Button>
    </div>
  );
}
