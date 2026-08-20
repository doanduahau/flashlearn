"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminUpdateCatalogSet,
  adminReplaceCatalogCards,
} from "@/features/admin/server/admin-catalog-actions";

type CatalogSet = Record<string, unknown>;
type CatalogCard = {
  id: string;
  front: string;
  back: string;
  position: number;
};
type Category = { id: string; name: string; slug: string };

export function CatalogDetailClient({
  set,
  cards: initialCards,
  installCount,
  categories,
}: Readonly<{
  set: CatalogSet;
  cards: CatalogCard[];
  installCount: number;
  categories: Category[];
}>) {
  const router = useRouter();
  const [cards, setCards] = useState<CatalogCard[]>(initialCards);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editingCards, setEditingCards] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Card editing state
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  async function handleMetadataSave(formData: FormData) {
    clearMessages();
    startTransition(async () => {
      const result = await adminUpdateCatalogSet(set.id as string, {
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        category_id: (formData.get("category_id") as string) || undefined,
        language_front: formData.get("language_front") as string,
        language_back: formData.get("language_back") as string,
        level: (formData.get("level") as string) || null,
      });
      if (result && !result.ok) {
        setError(result.error);
      } else {
        setSuccess("Đã cập nhật metadata.");
        setEditingMeta(false);
        router.refresh();
      }
    });
  }

  async function handleCardsSave() {
    clearMessages();
    startTransition(async () => {
      const result = await adminReplaceCatalogCards(
        set.id as string,
        cards.map((c) => ({ front: c.front, back: c.back })),
        "card editor update",
      );
      if (result && !result.ok) {
        setError(result.error);
      } else {
        setSuccess("Đã lưu thẻ.");
        setEditingCards(false);
        router.refresh();
      }
    });
  }

  function addCard() {
    if (!newFront.trim() || !newBack.trim()) return;
    setCards((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        front: newFront.trim(),
        back: newBack.trim(),
        position: prev.length,
      },
    ]);
    setNewFront("");
    setNewBack("");
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCard(index: number, field: "front" | "back", value: string) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function moveCard(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= cards.length) return;
    setCards((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next.map((c, i) => ({ ...c, position: i }));
    });
  }

  const statusColors: Record<string, string> = {
    draft: "bg-surface-subtle text-text-secondary",
    published: "bg-success/10 text-success",
    archived: "bg-warning/10 text-warning",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{set.title as string}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[set.status as string] ?? ""}`}
            >
              {set.status as string}
            </span>
            <span>v{set.version as number}</span>
            <span>·</span>
            <span>
              {set.language_front as string} → {set.language_back as string}
            </span>
            <span>·</span>
            <span>{cards.length} thẻ</span>
            <span>·</span>
            <span>{installCount} lượt cài</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingMeta(true)}>
            Sửa metadata
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCards(true);
            }}
          >
            Chỉnh sửa thẻ
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-success"
        >
          {success}
        </div>
      )}

      {/* Cards List (read-only view) */}
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Danh sách thẻ ({cards.length})</h2>
        {cards.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            Chưa có thẻ nào. Nhấn &quot;Chỉnh sửa thẻ&quot; để thêm.
          </p>
        ) : (
          <div className="mt-3 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Mặt trước</th>
                  <th className="px-3 py-2">Mặt sau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {cards.slice(0, 50).map((card, i) => (
                  <tr key={card.id} className="hover:bg-surface-subtle">
                    <td className="px-3 py-1.5 text-xs text-text-secondary">{i + 1}</td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 text-xs">{card.front}</td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 text-xs">{card.back}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cards.length > 50 && (
              <p className="mt-2 text-center text-xs text-text-secondary">
                Hiển thị 50/{cards.length} thẻ
              </p>
            )}
          </div>
        )}
      </section>

      {/* Metadata Info */}
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Thông tin</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-secondary">Slug</dt>
            <dd className="font-mono text-xs">{set.slug as string}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Mô tả</dt>
            <dd className="text-xs">{(set.description as string) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Starter</dt>
            <dd className="text-xs">{set.is_starter ? "✅ Có" : "Không"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Tạo lúc</dt>
            <dd className="text-xs">
              {new Date(set.created_at as string).toLocaleDateString("vi-VN")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Cập nhật</dt>
            <dd className="text-xs">
              {new Date(set.updated_at as string).toLocaleDateString("vi-VN")}
            </dd>
          </div>
        </dl>
      </section>

      {/* Edit Metadata Dialog */}
      <Dialog open={editingMeta} onOpenChange={setEditingMeta}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa metadata</DialogTitle>
            <DialogDescription>Chỉnh sửa thông tin bộ thư viện.</DialogDescription>
          </DialogHeader>
          <form action={handleMetadataSave} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="meta-title">Tiêu đề</Label>
              <Input
                id="meta-title"
                name="title"
                required
                maxLength={120}
                defaultValue={set.title as string}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meta-desc">Mô tả</Label>
              <Textarea
                id="meta-desc"
                name="description"
                maxLength={500}
                rows={2}
                defaultValue={(set.description as string) ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="meta-lang-front">Ngôn ngữ trước</Label>
                <Input
                  id="meta-lang-front"
                  name="language_front"
                  required
                  defaultValue={set.language_front as string}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-lang-back">Ngôn ngữ sau</Label>
                <Input
                  id="meta-lang-back"
                  name="language_back"
                  required
                  defaultValue={set.language_back as string}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="meta-category">Danh mục</Label>
                <Select name="category_id" defaultValue={(set.category_id as string) ?? ""}>
                  <SelectTrigger id="meta-category">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-level">Cấp độ</Label>
                <Input id="meta-level" name="level" defaultValue={(set.level as string) ?? ""} />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingMeta(false)}
                disabled={pending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Cards Dialog */}
      <Dialog open={editingCards} onOpenChange={setEditingCards}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thẻ ({cards.length})</DialogTitle>
            <DialogDescription>
              Thêm, sửa, xóa, sắp xếp thẻ. Nhấn &quot;Lưu&quot; để ghi nhận tất cả thay đổi.
            </DialogDescription>
          </DialogHeader>

          {/* Add new card */}
          <div className="flex gap-2">
            <Input
              placeholder="Mặt trước"
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Mặt sau"
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCard}
              disabled={!newFront.trim() || !newBack.trim()}
            >
              +
            </Button>
          </div>

          {/* Card list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {cards.map((card, i) => (
              <div
                key={card.id}
                className="flex items-center gap-1 rounded-lg border border-border-soft bg-surface-subtle p-2"
              >
                <span className="w-6 text-center text-xs text-text-secondary">{i + 1}</span>
                <Input
                  value={card.front}
                  onChange={(e) => updateCard(i, "front", e.target.value)}
                  className="h-7 flex-1 text-xs"
                />
                <Input
                  value={card.back}
                  onChange={(e) => updateCard(i, "back", e.target.value)}
                  className="h-7 flex-1 text-xs"
                />
                <div className="flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => moveCard(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => moveCard(i, 1)}
                    disabled={i === cards.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs text-danger"
                    onClick={() => removeCard(i)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingCards(false);
                setCards(initialCards);
              }}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button onClick={handleCardsSave} disabled={pending}>
              {pending ? "Đang lưu..." : `Lưu ${cards.length} thẻ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
