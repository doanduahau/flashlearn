import Link from "next/link";

const controlClassName =
  "inline-flex h-10 items-center justify-center rounded-xl border border-border-soft bg-surface px-4 text-sm font-medium";
const enabledControlClassName = `${controlClassName} hover:bg-surface-subtle`;
const disabledControlClassName = `${controlClassName} cursor-not-allowed opacity-50`;

export function PaginationControls({
  page,
  totalPages,
  pageHref,
}: Readonly<{
  page: number;
  totalPages: number;
  pageHref: (targetPage: number) => string;
}>) {
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-3">
      {hasPrevious ? (
        <Link href={pageHref(page - 1)} className={enabledControlClassName}>
          Trước
        </Link>
      ) : (
        <span className={disabledControlClassName} aria-disabled="true">
          Trước
        </span>
      )}
      <span className="text-sm text-text-secondary">
        Trang {page} / {totalPages}
      </span>
      {hasNext ? (
        <Link href={pageHref(page + 1)} className={enabledControlClassName}>
          Sau
        </Link>
      ) : (
        <span className={disabledControlClassName} aria-disabled="true">
          Sau
        </span>
      )}
    </nav>
  );
}
