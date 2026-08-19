import { AlertTriangle } from "lucide-react";

export function StorageQuotaWarning() {
  return (
    <div
      role="status"
      className="mb-5 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-text-primary"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
      <div>
        <p className="font-semibold">Bạn đang dùng vượt một giới hạn sắp được áp dụng</p>
        <p className="mt-1 text-sm text-text-secondary">
          Dữ liệu vẫn được lưu trong giai đoạn cảnh báo. Hãy giảm dung lượng hoặc số lượng nội dung
          trước khi chính sách giới hạn được bật.
        </p>
      </div>
    </div>
  );
}
