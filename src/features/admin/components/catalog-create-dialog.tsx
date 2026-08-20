"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCatalogSet } from "@/features/admin/server/admin-catalog-actions";

type Category = { id: string; name: string; slug: string };

export function CatalogCreateDialog({ categories }: Readonly<{ categories: Category[] }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCatalogSet({
        title: formData.get("title") as string,
        slug: formData.get("slug") as string,
        description: (formData.get("description") as string) || undefined,
        category_id: (formData.get("category_id") as string) || "",
        language_front: formData.get("language_front") as string,
        language_back: formData.get("language_back") as string,
        level: (formData.get("level") as string) || undefined,
      });
      if (result && !result.ok) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Thêm bộ thư viện</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo bộ thư viện mới</DialogTitle>
          <DialogDescription>
            Tạo bộ mới ở trạng thái Nháp. Sau khi tạo có thể chỉnh sửa và xuất bản.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="create-title">Tiêu đề *</Label>
            <Input
              id="create-title"
              name="title"
              required
              maxLength={120}
              placeholder="Ví dụ: TOEIC Unit 1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-slug">Slug *</Label>
            <Input
              id="create-slug"
              name="slug"
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              placeholder="toeic-unit-1"
            />
            <p className="text-xs text-text-secondary">
              Chữ thường, số, dấu gạch ngang. Phải独一无二.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-desc">Mô tả</Label>
            <Textarea
              id="create-desc"
              name="description"
              maxLength={500}
              rows={2}
              placeholder="Mô tả ngắn về bộ thư viện..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="create-lang-front">Ngôn ngữ trước</Label>
              <Input
                id="create-lang-front"
                name="language_front"
                required
                defaultValue="en"
                maxLength={32}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-lang-back">Ngôn ngữ sau</Label>
              <Input
                id="create-lang-back"
                name="language_back"
                required
                defaultValue="vi"
                maxLength={32}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="create-category">Danh mục</Label>
              <Select name="category_id">
                <SelectTrigger id="create-category">
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
              <Label htmlFor="create-level">Cấp độ</Label>
              <Input id="create-level" name="level" maxLength={32} placeholder="Ví dụ: beginner" />
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
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo bộ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
