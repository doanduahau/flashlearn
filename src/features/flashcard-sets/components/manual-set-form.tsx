"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importFlashcards } from "@/features/imports/server/actions";
import { importPayloadSchema } from "@/features/imports/schemas/import-schema";
import { CARD_TEXT_MAX_LENGTH, IMPORT_MAX_ROWS, SET_NAME_MAX_LENGTH } from "@/lib/constants";

type CardRow = { front: string; back: string };
type FieldErrors = Record<string, string>;

const focusableSelector =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

export function ManualSetForm() {
  const router = useRouter();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<CardRow[]>([{ front: "", back: "" }]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);

  const hasContent =
    name.trim() !== "" || rows.some((row) => row.front.trim() !== "" || row.back.trim() !== "");

  function close(): void {
    if (hasContent) {
      setConfirmClose(true);
      return;
    }
    router.push("/dashboard");
  }

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>("#manual-set-name")?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function updateRow(index: number, field: "front" | "back", value: string): void {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`${field}-${index}`];
      return next;
    });
  }

  function addRow(): void {
    setRows((current) =>
      current.length < IMPORT_MAX_ROWS ? [...current, { front: "", back: "" }] : current,
    );
  }

  function removeRow(index: number): void {
    setRows((current) => current.filter((_, i) => i !== index));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`front-${index}`];
      delete next[`back-${index}`];
      return next;
    });
  }

  function validate(): boolean {
    const parsed = importPayloadSchema.safeParse({ name, cards: rows });
    const next: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [root, index, field] = issue.path as [string, number, string];
        if (root === "name") {
          next.name = issue.message;
        } else if (root === "cards" && typeof index === "number") {
          next[`${field}-${index}`] = issue.message;
        }
      }
    }
    setFieldErrors(next);
    const firstInvalid = ["name", ...rows.flatMap((_, i) => [`front-${i}`, `back-${i}`])].find(
      (key) => key in next,
    );
    if (firstInvalid) {
      const id = firstInvalid === "name" ? "manual-set-name" : `manual-${firstInvalid}`;
      document.getElementById(id)?.focus();
    }
    return Object.keys(next).length === 0;
  }

  function submit(): void {
    if (pending) return;
    setError("");
    if (!validate()) return;
    startTransition(async () => {
      const result = await importFlashcards({ name, cards: rows });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/sets/${result.setId}`);
    });
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-text-primary/30 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tạo bộ thủ công"
        className="relative flex h-[100dvh] w-full flex-col bg-surface sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-border-soft sm:shadow-soft-card"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4">
          <h2 className="text-xl font-bold">Tạo bộ thủ công</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Đóng" onClick={close}>
            <X aria-hidden="true" />
          </Button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div>
              <Label htmlFor="manual-set-name">Tên bộ flashcard</Label>
              <Input
                id="manual-set-name"
                className="mt-1"
                value={name}
                maxLength={SET_NAME_MAX_LENGTH}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? "manual-set-name-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((current) => {
                    if (!current.name) return current;
                    const next = { ...current };
                    delete next.name;
                    return next;
                  });
                }}
              />
              {fieldErrors.name ? (
                <p id="manual-set-name-error" role="alert" className="mt-1 text-sm text-danger">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            <ol className="mt-5 space-y-4">
              {rows.map((row, index) => (
                <li
                  key={index}
                  className="rounded-2xl border border-border-soft bg-surface-subtle p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Thẻ {index + 1}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={rows.length === 1}
                      onClick={() => removeRow(index)}
                      aria-label={`Xóa thẻ ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" />
                      Xóa
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <Label htmlFor={`manual-front-${index}`}>Mặt trước</Label>
                      <Textarea
                        id={`manual-front-${index}`}
                        className="mt-1"
                        value={row.front}
                        maxLength={CARD_TEXT_MAX_LENGTH}
                        aria-invalid={fieldErrors[`front-${index}`] ? true : undefined}
                        aria-describedby={
                          fieldErrors[`front-${index}`] ? `manual-front-${index}-error` : undefined
                        }
                        onChange={(event) => updateRow(index, "front", event.target.value)}
                      />
                      {fieldErrors[`front-${index}`] ? (
                        <p
                          id={`manual-front-${index}-error`}
                          role="alert"
                          className="mt-1 text-sm text-danger"
                        >
                          {fieldErrors[`front-${index}`]}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor={`manual-back-${index}`}>Mặt sau</Label>
                      <Textarea
                        id={`manual-back-${index}`}
                        className="mt-1"
                        value={row.back}
                        maxLength={CARD_TEXT_MAX_LENGTH}
                        aria-invalid={fieldErrors[`back-${index}`] ? true : undefined}
                        aria-describedby={
                          fieldErrors[`back-${index}`] ? `manual-back-${index}-error` : undefined
                        }
                        onChange={(event) => updateRow(index, "back", event.target.value)}
                      />
                      {fieldErrors[`back-${index}`] ? (
                        <p
                          id={`manual-back-${index}-error`}
                          role="alert"
                          className="mt-1 text-sm text-danger"
                        >
                          {fieldErrors[`back-${index}`]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <Button
              type="button"
              variant="soft"
              className="mt-4"
              disabled={rows.length >= IMPORT_MAX_ROWS}
              onClick={addRow}
            >
              <Plus aria-hidden="true" />
              Thêm thẻ
            </Button>
          </div>

          <footer className="border-t border-border-soft px-5 py-4">
            {error ? (
              <p role="alert" className="mb-3 text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" disabled={pending} onClick={close}>
                Hủy
              </Button>
              <Button type="submit" size="lg" className="min-h-11 sm:min-h-10" disabled={pending}>
                {pending ? "Đang tạo…" : "Tạo bộ"}
              </Button>
            </div>
          </footer>
        </form>

        {confirmClose ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-text-primary/30 p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label="Xác nhận hủy"
              className="w-full max-w-sm rounded-2xl border border-border-soft bg-surface p-5 shadow-soft-card"
            >
              <h3 className="font-semibold">Hủy bộ chưa lưu?</h3>
              <p className="mt-1 text-sm text-text-secondary">Các thay đổi của bạn sẽ bị mất.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmClose(false)}>
                  Ở lại
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => router.push("/dashboard")}
                >
                  Rời đi
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
