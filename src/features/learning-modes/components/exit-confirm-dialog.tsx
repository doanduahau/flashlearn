import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { Button } from "@/components/ui/button";

export function ExitConfirmDialog({
  onCancel,
  onConfirm,
}: Readonly<{
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  return (
    <DialogOverlay title="Thoát phiên?" onClose={onCancel} className="max-w-[320px]">
      <div className="text-center sm:text-left">
        <h2 className="text-xl font-bold text-text-primary">Thoát phiên?</h2>
        <p className="mt-2 text-sm text-text-secondary">Tiến trình hiện tại sẽ bị mất.</p>
        <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            Hủy
          </Button>
          <Button variant="destructive" className="w-full sm:w-auto" onClick={onConfirm}>
            Thoát
          </Button>
        </div>
      </div>
    </DialogOverlay>
  );
}
