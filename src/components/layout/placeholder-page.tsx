import { Sparkles } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
}: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-text-secondary">{description}</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-border-soft bg-surface px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
          <Sparkles className="size-6 text-primary" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-heading text-lg font-bold">Đang được xây dựng</h2>
        <p className="mt-1 max-w-md text-sm text-text-secondary">
          Tính năng này sẽ được triển khai trong các giai đoạn tiếp theo.
        </p>
      </div>
    </div>
  );
}
