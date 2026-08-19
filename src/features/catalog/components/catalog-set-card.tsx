import { Check, Languages, Layers3 } from "lucide-react";
import Link from "next/link";

export type CatalogSetSummary = {
  id: string;
  title: string;
  description: string | null;
  categoryName: string;
  languageFront: string;
  languageBack: string;
  level: string | null;
  cardCount: number;
  isStarter: boolean;
  installed: boolean;
};

export function CatalogSetCard({ set }: Readonly<{ set: CatalogSetSummary }>) {
  return (
    <li>
      <Link
        href={`/sets/catalog/${set.id}`}
        className="flex h-full flex-col rounded-3xl border border-border-soft bg-surface p-5 outline-none transition-shadow hover:bg-surface-subtle hover:shadow-soft-card-hover focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex flex-wrap gap-2 text-xs font-medium text-text-secondary">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-primary-foreground">
            {set.categoryName}
          </span>
          {set.isStarter ? (
            <span className="rounded-full bg-surface-subtle px-3 py-1">Bộ khởi đầu</span>
          ) : null}
          {set.installed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-primary-foreground">
              <Check className="size-3" aria-hidden="true" />
              Đã thêm
            </span>
          ) : null}
        </div>
        <h2 className="mt-4 text-lg font-bold">{set.title}</h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-text-secondary">
          {set.description ?? "Bộ flashcard từ thư viện CapyStudy."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Layers3 className="size-4" aria-hidden="true" />
            {set.cardCount} thẻ
          </span>
          <span className="inline-flex items-center gap-1">
            <Languages className="size-4" aria-hidden="true" />
            {set.languageFront.toUpperCase()} → {set.languageBack.toUpperCase()}
          </span>
          {set.level ? <span>{set.level === "beginner" ? "Cơ bản" : set.level}</span> : null}
        </div>
      </Link>
    </li>
  );
}
