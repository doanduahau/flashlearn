"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

import {
  analyzeSheetText,
  discoverPrivateSheetHeaders,
  loadPrivateSheetValues,
  openGoogleSheet,
} from "@/features/imports/server/analyze-google-sheets";
import {
  fetchPublicSheetValues,
  fetchPublicSpreadsheet,
} from "@/features/imports/utils/public-sheets";
import { adaptSheetData } from "@/features/imports/adapters/google-sheets-adapter";
import type { MeaningfulColumn } from "@/features/imports/utils/detect-columns";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { columnIndexToLetters } from "@/features/imports/utils/sheets-a1";
import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { CreateSummary } from "@/features/imports/components/create-summary";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { IMPORT_PREVIEW_ROWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingDots } from "@/components/shared/loading-dots";

const COLUMN_REANALYZE_DEBOUNCE_MS = 250;

// Surfaces the real Google error (rate limit, grid limits, invalid range, …)
// instead of a generic message. The detail comes from Google's own response.
function sheetErrorMessage(result: { message: string; status?: number; detail?: string }): string {
  if (result.status === 429) {
    return "Đã vượt quá giới hạn yêu cầu Google Sheets. Vui lòng thử lại sau ít phút.";
  }
  if (result.detail) {
    return `${result.message} (${result.status ? `Mã ${result.status} — ` : ""}${result.detail})`;
  }
  return result.message;
}

function buildMeaningfulColumns(headers: string[]): MeaningfulColumn[] {
  const result: MeaningfulColumn[] = [];
  for (let i = 0; i < headers.length; i += 1) {
    const text = headers[i]?.trim();
    if (text && text.length > 0) {
      result.push({
        index: i,
        name: text,
      });
    }
  }
  return result;
}

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

type SheetMetaLike = {
  spreadsheetTitle: string;
  sheets: Array<{ title: string; sheetId: number; index: number }>;
};

type RawSheetData = {
  headers: string[];
  rows: string[][];
  rowCount: number;
};

export function GoogleSheetsImport({ mascotLevel }: Readonly<{ mascotLevel: MascotLevel }>) {
  const [mode, setMode] = useState<Mode>("init");
  const [error, setError] = useState("");
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [frontColumn, setFrontColumn] = useState(0);
  const [backColumn, setBackColumn] = useState(1);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [meaningfulColumns, setMeaningfulColumns] = useState<MeaningfulColumn[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isPublicFlow, setIsPublicFlow] = useState(false);
  const [fullCards, setFullCards] = useState<DraftFlashcard[] | null>(null);

  const tokenClientRef = useRef<{ requestAccessToken: () => void } | null>(null);
  const gapiLoadedRef = useRef(false);
  const sheetTitleRef = useRef("");
  const reanalyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = getGoogleConfig();
  const isConfigured = Boolean(config.clientId && config.apiKey && config.appId);
  const isPending =
    mode === "picker_loading" || mode === "opening" || mode === "analyzing" || mode === "importing";

  useEffect(() => {
    return () => {
      if (reanalyzeTimerRef.current) {
        clearTimeout(reanalyzeTimerRef.current);
      }
    };
  }, []);

  const initGapi = useCallback(() => {
    if (typeof window === "undefined" || gapiLoadedRef.current) return;
    gapiLoadedRef.current = true;
    window.gapi?.load("picker", () => {});
  }, []);

  function applyAnalysis(
    meta: SheetMetaLike,
    sheetData: RawSheetData,
    preferredMapping?: { frontColumn: number; backColumn: number },
  ): void {
    const analysis = adaptSheetData(sheetData, preferredMapping);

    if (analysis.kind === "error") {
      setFullCards(null);
      setError(analysis.message);
      setMode("loaded");
      return;
    }

    if (analysis.kind === "needs_mapping") {
      // No automatic front/back detection: fall back to the first two
      // discovered columns so the column selectors and preview always appear
      // right after analysis. The discovered columns already cover every
      // column that has data (full-sheet scan), so the user can pick any pair.
      const columns = meaningfulColumns;
      const fallbackMapping = {
        frontColumn: columns[0]?.index ?? 0,
        backColumn: columns[1]?.index ?? columns[0]?.index ?? 1,
      };
      const fallback = adaptSheetData(sheetData, fallbackMapping);
      if (fallback.kind !== "structured") {
        setFullCards(null);
        setError("Không thể xác định cột dữ liệu.");
        setMode("loaded");
        return;
      }
      const validation = validateDraftCards(fallback.cards);
      setFullCards(validation.cards);
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
        frontColumn: fallbackMapping.frontColumn,
        backColumn: fallbackMapping.backColumn,
      });
      setFrontColumn(fallbackMapping.frontColumn);
      setBackColumn(fallbackMapping.backColumn);
      setNeedsMapping(false);
      setMode("loaded");
      return;
    }

    if (analysis.kind === "single_column_semantic") {
      void runSemantic(analysis.text);
      return;
    }

    const validation = validateDraftCards(analysis.cards);
    setFullCards(validation.cards);
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
        setFullCards(result.cards);
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

  async function loadValues(
    meta: SheetMetaLike,
    sheetTitle: string,
    columns: number[],
    preferredMapping?: { frontColumn: number; backColumn: number },
  ): Promise<void> {
    if (columns.length === 0) {
      setError("Chưa xác định được cột dữ liệu.");
      setMode("loaded");
      return;
    }
    setMode("opening");
    setError("");
    try {
      let result;
      if (isPublicFlow) {
        result = await fetchPublicSheetValues(spreadsheetId, sheetTitle, config.apiKey, columns);
      } else {
        result = await loadPrivateSheetValues({
          spreadsheetId,
          accessToken,
          sheetTitle,
          columns,
        });
      }
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(sheetErrorMessage(result));
        setMode("loaded");
        return;
      }
      applyAnalysis(meta, result.sheetData, preferredMapping);
    } catch (err) {
      console.error("Google Sheets values fetch failed", err);
      setError("Không thể đọc dữ liệu bảng tính. Vui lòng thử lại.");
      setMode("loaded");
    }
  }

  function handleDiscovered(meta: SheetMetaLike, headers: string[], sheetTitle: string): void {
    sheetTitleRef.current = sheetTitle;
    const meaningful = buildMeaningfulColumns(headers);
    setMeaningfulColumns(meaningful);

    const fCol = meaningful[0]?.index ?? 0;
    const bCol =
      meaningful[1]?.index ?? (meaningful[0]?.index !== undefined ? meaningful[0].index : 1);

    setFrontColumn(fCol);
    setBackColumn(bCol);
    setSheetInfo({
      spreadsheetTitle: meta.spreadsheetTitle,
      sheets: meta.sheets,
      headers,
      rowCount: 0,
      previewRows: [],
      valid: 0,
      blank: 0,
      partial: 0,
      duplicate: 0,
      frontColumn: fCol,
      backColumn: bCol,
    });
    setFullCards(null);
    setMode("loaded");
  }

  async function analyzeWithMapping(explicitFront?: number, explicitBack?: number): Promise<void> {
    if (!sheetInfo) return;
    const front = explicitFront ?? frontColumn;
    const back = explicitBack ?? backColumn;
    setMode("analyzing");
    setError("");
    const meta = {
      spreadsheetTitle: sheetInfo.spreadsheetTitle,
      sheets: sheetInfo.sheets,
    };

    const allColIndices = meaningfulColumns.map((c) => c.index);
    const colsToFetch = allColIndices.length >= 2 ? allColIndices : [front, back];
    // When the user picks columns explicitly (first analysis or a dropdown
    // change), keep that mapping; otherwise let automatic detection decide.
    const preferredMapping =
      explicitFront !== undefined && explicitBack !== undefined
        ? { frontColumn: explicitFront, backColumn: explicitBack }
        : undefined;

    await loadValues(
      meta,
      sheetTitleRef.current || sheetInfo.sheets[selectedSheetIndex]?.title || "",
      colsToFetch,
      preferredMapping,
    );
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
        setError(sheetErrorMessage(result));
        setMode("init");
        return;
      }
      handleDiscovered(result.meta, result.headers, result.sheetTitle);
    } catch (err) {
      console.error("Google Sheets open failed", err);
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
      const result = await discoverPrivateSheetHeaders({
        spreadsheetId,
        accessToken,
        sheetTitle: sheet.title,
      });
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(sheetErrorMessage(result));
        setMode("loaded");
        return;
      }
      handleDiscovered(result.meta, result.headers, result.sheetTitle);
    } catch (err) {
      console.error("Google Sheets header discovery failed", err);
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
        setError(sheetErrorMessage(result));
        setMode("loaded");
        return;
      }
      handleDiscovered(result.meta, result.headers, result.sheetTitle);
    } catch (err) {
      console.error("Google Sheets public open failed", err);
      setError("Không thể mở sheet.");
      setMode("loaded");
    }
  }

  async function changeSheet(newIndex: number): Promise<void> {
    if (isPublicFlow) await changePublicSheet(newIndex);
    else await changePrivateSheet(newIndex);
  }

  function scheduleReanalysis(front: number, back: number): void {
    if (front === back || isPending) return;
    if (reanalyzeTimerRef.current) {
      clearTimeout(reanalyzeTimerRef.current);
    }
    reanalyzeTimerRef.current = setTimeout(() => {
      reanalyzeTimerRef.current = null;
      void analyzeWithMapping(front, back);
    }, COLUMN_REANALYZE_DEBOUNCE_MS);
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
      if (result.kind === "error" || result.kind === "auth_required") {
        setError(sheetErrorMessage(result));
        setMode("init");
        return;
      }
      setSpreadsheetId(extractIdFromUrl(urlInput));
      setIsPublicFlow(true);
      handleDiscovered(result.meta, result.headers, result.sheetTitle);
    } catch (err) {
      console.error("Google Sheets paste URL failed", err);
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
        <div role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <MascotImage
            level={mascotLevel}
            state="thinking"
            size={64}
            className="size-16 object-contain"
          />
          <LoadingDots
            label={mode === "picker_loading" ? "Đang kết nối Google Drive" : "Đang đọc bảng tính"}
          />
        </div>
      )}

      {mode === "loaded" && sheetInfo && (
        <>
          {!fullCards ? (
            <div className="space-y-4 rounded-2xl border border-border-soft bg-surface p-5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text-secondary">Bảng tính</span>
                <p className="font-bold text-text-primary">{sheetInfo.spreadsheetTitle}</p>
              </div>

              {sheetInfo.sheets.length > 1 && (
                <div>
                  <Label
                    htmlFor="gs-sheet-select"
                    className="text-sm font-semibold text-text-primary"
                  >
                    Chọn bảng
                  </Label>
                  <select
                    id="gs-sheet-select"
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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

              <div className="flex gap-3 pt-2">
                <Button onClick={() => void analyzeWithMapping()} disabled={isPending}>
                  Phân tích
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMode("init");
                    setSheetInfo(null);
                    setFullCards(null);
                    setUrlInput("");
                  }}
                >
                  Đổi liên kết
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {meaningfulColumns.length > 0 && (
                <div className="rounded-2xl border border-border-soft bg-surface p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor="gs-front-col"
                        className="text-sm font-semibold text-text-primary"
                      >
                        Mặt trước
                      </Label>
                      <select
                        id="gs-front-col"
                        className="mt-1.5 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={frontColumn}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setFrontColumn(next);
                          scheduleReanalysis(next, backColumn);
                        }}
                        disabled={isPending}
                      >
                        {meaningfulColumns.map((col) => (
                          <option key={col.index} value={col.index}>
                            {col.name || columnIndexToLetters(col.index)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label
                        htmlFor="gs-back-col"
                        className="text-sm font-semibold text-text-primary"
                      >
                        Mặt sau
                      </Label>
                      <select
                        id="gs-back-col"
                        className="mt-1.5 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={backColumn}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setBackColumn(next);
                          scheduleReanalysis(frontColumn, next);
                        }}
                        disabled={isPending}
                      >
                        {meaningfulColumns.map((col) => (
                          <option key={col.index} value={col.index}>
                            {col.name || columnIndexToLetters(col.index)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {sheetInfo.sheets.length > 1 && (
                    <div className="mt-4 border-t border-border-soft pt-3">
                      <Label
                        htmlFor="gs-sheet-select-change"
                        className="text-xs font-medium text-text-secondary"
                      >
                        Đổi bảng
                      </Label>
                      <select
                        id="gs-sheet-select-change"
                        className="mt-1 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm text-text-primary"
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
                </div>
              )}

              {frontColumn === backColumn ? (
                <p role="alert" className="text-danger font-medium">
                  Mặt trước và mặt sau phải dùng hai cột khác nhau.
                </p>
              ) : null}

              <CreateSummary
                key={`sheets-${selectedSheetIndex}-${frontColumn}-${backColumn}`}
                sourceCards={fullCards}
                sourceMetadata={[
                  { label: "Bảng tính", value: sheetInfo.spreadsheetTitle },
                  ...(sheetInfo.sheets.length > 1
                    ? [
                        {
                          label: "Tab",
                          value: sheetInfo.sheets[selectedSheetIndex]?.title ?? "",
                        },
                      ]
                    : []),
                ]}
                mascotLevel={mascotLevel}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFullCards(null);
                  }}
                >
                  Đổi bảng tính
                </Button>
              </CreateSummary>
            </div>
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
