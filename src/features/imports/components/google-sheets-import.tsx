"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

import {
  analyzeSheetText,
  loadPrivateSheetValues,
  openGoogleSheet,
} from "@/features/imports/server/analyze-google-sheets";
import { importFlashcards } from "@/features/imports/server/actions";
import { fetchPublicSpreadsheet } from "@/features/imports/utils/public-sheets";
import { adaptSheetData } from "@/features/imports/adapters/google-sheets-adapter";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { IMPORT_PREVIEW_ROWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SheetInfo = {
  spreadsheetTitle: string;
  sheets: Array<{ title: string; sheetId: number; index: number }>;
  headers: string[];
  rowCount: number;
  previewRows: DraftFlashcard[];
  valid: number;
  blank: number;
  partial: number;
  duplicate: number;
  frontColumn: number;
  backColumn: number;
};

declare global {
  interface Window {
    gapi?: {
      load: (lib: string, cb: () => void) => void;
    };
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (c: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
      picker: {
        DocsView: new (viewId: unknown) => {
          setMimeTypes: (m: string) => void;
          setMode: (m: unknown) => void;
        };
        ViewId: { SPREADSHEETS: unknown };
        DocsViewMode: { LIST: unknown };
        PickerBuilder: new () => {
          setAppId: (id: string) => unknown;
          setOAuthToken: (t: string) => void;
          addView: (v: unknown) => void;
          setDeveloperKey: (k: string) => void;
          setCallback: (
            cb: (data: {
              action: string;
              docs?: Array<{ id: string; name: string; mimeType: string }>;
            }) => void,
          ) => void;
          build: () => { setVisible: (v: boolean) => void };
        };
      };
    };
  }
}

function getGoogleConfig() {
  return {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "",
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "",
    appId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID ?? "",
  };
}

type Mode = "init" | "picker_loading" | "opening" | "loaded" | "analyzing" | "importing";

export function GoogleSheetsImport() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("init");
  const [error, setError] = useState("");
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);
  const [name, setName] = useState("");
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [frontColumn, setFrontColumn] = useState(0);
  const [backColumn, setBackColumn] = useState(1);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isPublicFlow, setIsPublicFlow] = useState(false);

  const tokenClientRef = useRef<{ requestAccessToken: () => void } | null>(null);
  const gapiLoadedRef = useRef(false);

  const config = getGoogleConfig();
  const isConfigured = Boolean(config.clientId && config.apiKey && config.appId);
  const isPending =
    mode === "picker_loading" || mode === "opening" || mode === "analyzing" || mode === "importing";

  const initGapi = useCallback(() => {
    if (typeof window === "undefined" || gapiLoadedRef.current) return;
    gapiLoadedRef.current = true;
    window.gapi?.load("picker", () => {});
  }, []);

  type SheetMetaLike = {
    spreadsheetTitle: string;
    sheets: Array<{ title: string; sheetId: number; index: number }>;
  };

  type RawSheetData = {
    headers: string[];
    rows: string[][];
    rowCount: number;
  };

  function applyAnalysis(
    meta: SheetMetaLike,
    sheetData: RawSheetData,
    preferredMapping?: { frontColumn: number; backColumn: number },
  ): void {
    const analysis = adaptSheetData(sheetData, preferredMapping);

    if (analysis.kind === "error") {
      setError(analysis.message);
      setMode("loaded");
      return;
    }

    if (analysis.kind === "needs_mapping") {
      setSheetInfo({
        spreadsheetTitle: meta.spreadsheetTitle,
        sheets: meta.sheets,
        headers: analysis.columns,
        rowCount: sheetData.rowCount,
        previewRows: [],
        valid: 0,
        blank: 0,
        partial: 0,
        duplicate: 0,
        frontColumn: 0,
        backColumn: 1,
      });
      setNeedsMapping(true);
      setMode("loaded");
      return;
    }

    if (analysis.kind === "single_column_semantic") {
      void runSemantic(analysis.text);
      return;
    }

    const validation = validateDraftCards(analysis.cards);
    setSheetInfo({
      spreadsheetTitle: meta.spreadsheetTitle,
      sheets: meta.sheets,
      headers: sheetData.headers,
      rowCount: sheetData.rowCount,
      previewRows: validation.cards.slice(0, IMPORT_PREVIEW_ROWS),
      valid: validation.valid,
      blank: validation.blank,
      partial: validation.partial,
      duplicate: validation.duplicate,
      frontColumn: analysis.mapping.frontColumn,
      backColumn: analysis.mapping.backColumn,
    });
    setFrontColumn(analysis.mapping.frontColumn);
    setBackColumn(analysis.mapping.backColumn);
    setNeedsMapping(false);
    setMode("loaded");
  }

  async function runSemantic(text: string): Promise<void> {
    setMode("analyzing");
    try {
      const result = await analyzeSheetText({ text });
      if (result.kind === "success") {
        if (sheetInfo) {
          setSheetInfo({
            ...sheetInfo,
            previewRows: result.cards.slice(0, IMPORT_PREVIEW_ROWS),
            valid: result.valid,
            blank: result.blank,
            partial: result.partial,
            duplicate: result.duplicate,
          });
        }
        setMode("loaded");
      } else {
        setError(result.message);
        setMode("loaded");
      }
    } catch {
      setError("Không thể phân tích nội dung.");
      setMode("loaded");
    }
  }

  function requestToken(): void {
    if (!config.clientId) {
      setError("Google OAuth chưa được cấu hình.");
      return;
    }
    if (!tokenClientRef.current) {
      if (!window.google?.accounts?.oauth2) {
        setError("Google API chưa sẵn sàng.");
        return;
      }
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response) => {
          if (response.error) {
            setError("Không thể kết nối Google Drive.");
            setMode("init");
            return;
          }
          if (response.access_token) {
            openPicker(response.access_token);
          }
        },
      });
    }
    setMode("picker_loading");
    tokenClientRef.current.requestAccessToken();
  }

  function openPicker(token: string): void {
    if (!window.google?.picker || !config.apiKey || !config.appId) return;
    setAccessToken(token);

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
    view.setMimeTypes("application/vnd.google-apps.spreadsheet");
    view.setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder();
    picker.setAppId(config.appId);
    picker.setOAuthToken(token);
    picker.addView(view as unknown);
    picker.setDeveloperKey(config.apiKey);
    picker.setCallback(
      (data: { action: string; docs?: Array<{ id: string; mimeType: string }> }) => {
        if (data.action === "picked" && data.docs?.length) {
          const file = data.docs[0];
          if (file.mimeType !== "application/vnd.google-apps.spreadsheet") {
            setError("Vui lòng chọn một Google Sheets.");
            setMode("init");
            return;
          }
          setSpreadsheetId(file.id);
          setIsPublicFlow(false);
          setMode("opening");
          setError("");
          void loadPrivate(file.id, token, 0);
        } else if (data.action === "cancel") {
          setMode("init");
        }
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const built = (picker as any).build();
    built.setVisible(true);
  }

  async function loadPrivate(id: string, token: string, sheetIdx: number): Promise<void> {
    try {
      const result = await openGoogleSheet({
        spreadsheetId: id,
        accessToken: token,
        sheetIndex: sheetIdx,
      });
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(result.message);
        setMode("init");
        return;
      }
      applyAnalysis(result.meta, result.sheetData);
    } catch {
      setError("Không thể mở bảng tính.");
      setMode("init");
    }
  }

  async function changePrivateSheet(newIndex: number): Promise<void> {
    if (!sheetInfo) return;
    const sheet = sheetInfo.sheets[newIndex];
    if (!sheet) return;
    setSelectedSheetIndex(newIndex);
    setMode("opening");
    setError("");
    try {
      const result = await loadPrivateSheetValues({
        spreadsheetId,
        accessToken,
        sheetTitle: sheet.title,
      });
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(result.message);
        setMode("loaded");
        return;
      }
      const meta = {
        spreadsheetTitle: sheetInfo.spreadsheetTitle,
        sheets: sheetInfo.sheets,
      };
      applyAnalysis(meta, result.sheetData);
    } catch {
      setError("Không thể mở sheet.");
      setMode("loaded");
    }
  }

  async function changePublicSheet(newIndex: number): Promise<void> {
    if (!sheetInfo) return;
    const sheet = sheetInfo.sheets[newIndex];
    if (!sheet) return;
    setSelectedSheetIndex(newIndex);
    setMode("opening");
    setError("");
    try {
      const result = await fetchPublicSpreadsheet(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        config.apiKey,
        newIndex,
      );
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(result.message);
        setMode("loaded");
        return;
      }
      applyAnalysis(result.meta, result.sheetData);
    } catch {
      setError("Không thể mở sheet.");
      setMode("loaded");
    }
  }

  async function changeSheet(newIndex: number): Promise<void> {
    if (isPublicFlow) await changePublicSheet(newIndex);
    else await changePrivateSheet(newIndex);
  }

  async function analyzeWithMapping(): Promise<void> {
    if (!sheetInfo) return;
    setMode("analyzing");
    setError("");
    const mapping = { frontColumn, backColumn };
    const meta = {
      spreadsheetTitle: sheetInfo.spreadsheetTitle,
      sheets: sheetInfo.sheets,
    };
    // Re-run analysis on already-loaded data with the user's chosen mapping.
    if (isPublicFlow) {
      const result = await fetchPublicSpreadsheet(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        config.apiKey,
        selectedSheetIndex,
      );
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(result.message);
        setMode("loaded");
        return;
      }
      applyAnalysis(meta, result.sheetData, mapping);
    } else {
      const sheet = sheetInfo.sheets[selectedSheetIndex];
      if (!sheet) {
        setError("Sheet không tồn tại.");
        setMode("loaded");
        return;
      }
      const result = await loadPrivateSheetValues({
        spreadsheetId,
        accessToken,
        sheetTitle: sheet.title,
      });
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(result.message);
        setMode("loaded");
        return;
      }
      applyAnalysis(meta, result.sheetData, mapping);
    }
  }

  async function submitImport(): Promise<void> {
    if (!sheetInfo || sheetInfo.previewRows.length === 0) {
      setError("Chưa có thẻ nào để import.");
      return;
    }
    setMode("importing");
    setError("");
    try {
      const result = await importFlashcards({ name, cards: sheetInfo.previewRows });
      if ("error" in result) {
        setError(result.error);
        setMode("loaded");
        return;
      }
      router.push(`/sets/${result.setId}`);
    } catch {
      setError("Không thể tạo bộ.");
      setMode("loaded");
    }
  }

  async function handlePasteUrl(): Promise<void> {
    if (!urlInput.trim()) {
      setError("Vui lòng dán liên kết Google Sheets.");
      return;
    }
    if (!config.apiKey) {
      setError("Google Sheets chưa được cấu hình.");
      return;
    }
    setMode("opening");
    setError("");
    try {
      const result = await fetchPublicSpreadsheet(urlInput, config.apiKey, 0);
      if (result.kind === "error") {
        setError(result.message);
        setMode("init");
        return;
      }
      if (result.kind === "auth_required") {
        setError(result.message);
        setMode("init");
        return;
      }
      setSpreadsheetId(extractIdFromUrl(urlInput));
      setIsPublicFlow(true);
      applyAnalysis(result.meta, result.sheetData);
    } catch {
      setError("Không thể đọc bảng tính.");
      setMode("init");
    }
  }

  function extractIdFromUrl(url: string): string {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{30,})\//);
    return m?.[1] ?? "";
  }

  if (!isConfigured) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">Google Sheets import chưa được cấu hình.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Script
        src="https://apis.google.com/js/api.js"
        onLoad={initGapi}
        strategy="afterInteractive"
      />
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      {mode === "init" && (
        <>
          <Button onClick={requestToken} disabled={isPending}>
            Chọn bảng tính từ Google Drive
          </Button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border-soft" />
            <span className="text-xs text-text-secondary">hoặc</span>
            <div className="h-px flex-1 bg-border-soft" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gs-url-input">Dán liên kết Google Sheets</Label>
            <div className="flex gap-2">
              <Input
                id="gs-url-input"
                className="flex-1"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setError("");
                }}
                disabled={isPending}
              />
              <Button
                onClick={handlePasteUrl}
                disabled={isPending || !urlInput.trim()}
                variant="outline"
              >
                Đọc
              </Button>
            </div>
          </div>
        </>
      )}

      {(mode === "picker_loading" || mode === "opening") && (
        <p className="text-sm text-text-secondary">
          {mode === "picker_loading" ? "Đang kết nối Google Drive..." : "Đang đọc bảng tính..."}
        </p>
      )}

      {mode === "loaded" && sheetInfo && (
        <>
          <div className="text-sm">
            <span className="text-text-secondary">Bảng tính: </span>
            <span className="font-medium">{sheetInfo.spreadsheetTitle}</span>
          </div>

          {sheetInfo.sheets.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="gs-sheet-select">Bảng</Label>
              <select
                id="gs-sheet-select"
                className="rounded-xl border border-border-soft bg-surface px-4 py-2 text-sm focus:border-primary focus:outline-none"
                value={selectedSheetIndex}
                onChange={(e) => {
                  void changeSheet(Number(e.target.value));
                }}
                disabled={isPending}
              >
                {sheetInfo.sheets.map((s) => (
                  <option key={s.sheetId} value={s.index}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(needsMapping || sheetInfo.headers.length > 2) && (
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="gs-front-col">Mặt trước</Label>
                <select
                  id="gs-front-col"
                  className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={frontColumn}
                  onChange={(e) => setFrontColumn(Number(e.target.value))}
                  disabled={isPending}
                >
                  {sheetInfo.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Cột ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="gs-back-col">Mặt sau</Label>
                <select
                  id="gs-back-col"
                  className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={backColumn}
                  onChange={(e) => setBackColumn(Number(e.target.value))}
                  disabled={isPending}
                >
                  {sheetInfo.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Cột ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <Button onClick={analyzeWithMapping} disabled={isPending || frontColumn === backColumn}>
            {(() => {
              const m: string = mode;
              return m === "analyzing" ? "Đang phân tích..." : "Phân tích";
            })()}
          </Button>

          {sheetInfo.previewRows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-sm text-text-secondary">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-foreground">
                  {sheetInfo.valid} thẻ hợp lệ
                </span>
                {sheetInfo.blank > 0 && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs">
                    {sheetInfo.blank} dòng trống
                  </span>
                )}
                {sheetInfo.partial > 0 && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs">
                    {sheetInfo.partial} thiếu
                  </span>
                )}
                {sheetInfo.duplicate > 0 && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs">
                    {sheetInfo.duplicate} trùng
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-auto rounded-xl border border-border-soft bg-surface sm:max-h-80">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface-subtle">
                    <tr className="text-xs text-text-secondary">
                      <th className="px-3 py-2 font-medium sm:px-4">Mặt trước</th>
                      <th className="px-3 py-2 font-medium sm:px-4">Mặt sau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetInfo.previewRows.map((card, i) => (
                      <tr key={i} className="border-t border-border-soft">
                        <td className="px-3 py-2 sm:px-4">{card.front}</td>
                        <td className="px-3 py-2 sm:px-4">{card.back}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheetInfo.valid > IMPORT_PREVIEW_ROWS && (
                  <p className="px-3 py-2 text-xs text-text-secondary">
                    Hiển thị {IMPORT_PREVIEW_ROWS} / {sheetInfo.valid} thẻ
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="gs-set-name">Tên bộ</Label>
                <Input
                  id="gs-set-name"
                  placeholder="Nhập tên bộ flashcard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <Button
                onClick={submitImport}
                disabled={!name.trim() || sheetInfo.previewRows.length === 0 || isPending}
              >
                {(() => {
                  const m: string = mode;
                  return m === "importing" ? "Đang import..." : "Tạo bộ";
                })()}
              </Button>
            </>
          )}
        </>
      )}

      {error && (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
