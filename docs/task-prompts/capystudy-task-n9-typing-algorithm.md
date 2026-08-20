# CapyStudy Task N9 — Chấm đáp án typing 2 bước: thuật toán local trước + AI (Gemini) dò câu sai

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main) — **KHÔNG phụ thuộc task khác** (thuần helper + adapter AI, không DB)
- `Agent tier`: DeepSeek Flash + Gemini (logic + AI adapter — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: grade typing answers with local matching and ai review`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> "hệ thống sẽ chấm trước, nếu có câu sai thì AI sẽ dò, nếu giống về mặt ý nghĩa và cùng ngôn ngữ thì tính đúng."

**Cơ chế 2 bước:**

1. **Bước 1 — local:** chấm bằng thuật toán chuẩn hóa + similarity (giống thiết kế cũ)
2. **Bước 2 — AI dò:** câu nào bị local chấm **SAI** → gọi **Gemini** dò lại — nếu đáp án người dùng **giống nghĩa + cùng ngôn ngữ** với đáp án đúng → tính **ĐÚNG**
3. Câu local chấm ĐÚNG → **không gọi AI** (tiết kiệm cost)
4. AI lỗi / không có key → **giữ kết quả local** (không bao giờ chặn bài)

## 2. Hiện trạng hạ tầng AI (đã rà — TÁI SỬ DỤNG, không xây mới)

- `GEMINI_API_KEY` đã có trong env (server secret) — đọc qua `getGeminiApiKey()` (`src/lib/env.ts`)
- SDK `@google/genai` đã cài; model dùng chung: **`gemini-flash-lite-latest`**
- Pattern tham khảo: `src/features/imports/adapters/gemini-provider.ts` — `GoogleGenAI({ apiKey })` + `generateContent` với `responseMimeType: "application/json"` + `responseSchema` (JSON schema từ `Type`) + `httpOptions.retryOptions.attempts` (dùng `GEMINI_RETRY_ATTEMPTS = 1` từ `gemini-retry-policy.ts`)
- E2E dùng mock test-only (`FLASHLEARN_GENERATION_MOCK`...) — KHÔNG gọi Gemini thật trong test
- File Gemini adapter đều có `import "server-only"` — KHÔNG bao giờ vào browser

## 3. Phạm vi task

1. `src/features/typing/utils/answer-match.ts` (mới) — helper local thuần: `normalizeAnswer` + `isAnswerCorrect` + `levenshtein` (thiết kế cũ giữ nguyên)
2. `src/features/typing/server/answer-check.ts` (mới, "use server" hoặc server-only) — `gradeTypingAnswer(userAnswer, correctAnswer): Promise<boolean>` — 2 bước: local → AI (chỉ khi local sai)
3. `src/features/typing/server/gemini-answer-check.ts` (mới, `import "server-only"`) — adapter gọi Gemini, tái sử dụng `GoogleGenAI`/`getGeminiApiKey`/`GEMINI_RETRY_ATTEMPTS`/model `gemini-flash-lite-latest` — trả boolean
4. Unit test — mock AI provider: cover đầy đủ (mục 3.3)
5. **KHÔNG làm:** DB, UI (Task N10), migration, sửa gemini-provider/gemini-retry-policy (chỉ IMPORT)

## 3. Thiết kế chi tiết

### 3.1. `answer-match.ts` (local — giữ thiết kế cũ, KHÔNG đổi)

- `normalizeAnswer(text)`: trim + collapse space + lowercase + **bỏ dấu tiếng Việt** (NFD + remove combining marks + đ/Đ→d) + bỏ dấu câu 2 đầu từ; giữ số
- `isAnswerCorrect(userAnswer, correctAnswer)`: (1) trùng chuẩn hóa → true; (2) token intersection/max ≥ **0.8** → true; (3) Levenshtein ratio ≥ **0.85** (độ dài ≥ 4) → true; (4) else false
- `levenshtein(a, b)` thuần, không thư viện
- Cả 2 normalize rỗng → false

### 3.2. `gemini-answer-check.ts` (AI dò — adapter mới)

Pattern theo `gemini-provider.ts` (import `GoogleGenAI`, `Type` từ `@google/genai`; `getGeminiApiKey`; `GEMINI_RETRY_ATTEMPTS`; model `gemini-flash-lite-latest`; `import "server-only"`):

```ts
export async function checkAnswerWithAI(input: {
  userAnswer: string;
  correctAnswer: string;
}): Promise<{ correct: boolean; reason: string | null }>;
```

- Không có API key → throw rõ ràng (caller bắt → fallback local)
- Prompt (tiếng Anh, rõ ràng — kèm giới hạn): AI là giáo viên chấm bài; nhận "user answer" + "correct answer"; xác định: (a) **cùng ngôn ngữ** không, (b) **tương đồng ý nghĩa** không (đồng nghĩa, viết tắt, cách diễn đạt khác nhưng cùng nghĩa, sai chính tả nhẹ); trả JSON `{ "correct": boolean, "reason": string }` (reason ngắn tiếng Việt, null/"" khi đúng)
- Dùng `responseSchema` JSON (`Type.OBJECT`, properties `correct` (boolean) + `reason` (string), required cả 2) — pattern gemini-provider
- `responseMimeType: "application/json"`, retry attempts 1
- Parse + validate output; AI trả không hợp lệ → throw (caller fallback local)
- **Giới hạn cost:** mỗi câu sai 1 lần gọi; nếu bài có NHIỀU câu sai → gọi lần lượt (hoặc gộp 1 call nhiều câu — chọn 1, ghi rõ; ưu tiên **gộp tối đa 10 câu/lần gọi** để giảm cost, vẫn 1 attempt)
  - Nếu gộp: API nhận mảng câu + trả mảng kết quả — thiết kế rõ, ghi trong evidence

### 3.3. `answer-check.ts` (orchestrator — server)

```ts
export async function gradeTypingAnswer(
  userAnswer: string,
  correctAnswer: string,
): Promise<boolean> {
  if (isAnswerCorrect(userAnswer, correctAnswer)) return true; // local đúng → không gọi AI
  try {
    const ai = await checkAnswerWithAI({ userAnswer, correctAnswer }); // hoặc batch
    return ai.correct;
  } catch {
    return false; // AI lỗi / thiếu key → giữ kết quả local (sai)
  }
}
```

- KHÔNG log nội dung đáp án (server log sạch — AGENTS rule)
- Đây là hàm server (gọi Gemini) — đặt trong feature typing, `import "server-only"` nếu cần

### 3.4. Tests (`tests/unit/features/typing/`)

- `answer-match.test.ts` — giữ đầy đủ case cũ (mục 3.3 bản cũ): trùng/thiếu dấu/thứ tự từ/thừa thiếu từ/sai chính tả/khác nghĩa/rỗng/số/ngắn
- `grade-typing-answer.test.ts` (mock module Gemini):
  - Local đúng ("xin chao" vs "xin chào") → **true, KHÔNG gọi AI** (spy: AI không được gọi)
  - Local sai + AI true ("cách học tiếng anh" vs "phương pháp học tiếng Anh") → true
  - Local sai + AI false → false
  - AI throw (mock reject) → false (fallback local, không crash)
  - Không có API key → false
  - Batch: nhiều câu sai → 1 lần gọi AI (nếu chọn batch)
- KHÔNG gọi Gemini thật trong test — mock module

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. `npx vitest run tests/unit/features/typing` — pass
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/typing/utils/answer-match.ts` (mới)
- `src/features/typing/server/answer-check.ts` (mới)
- `src/features/typing/server/gemini-answer-check.ts` (mới)
- `tests/unit/features/typing/answer-match.test.ts` (mới)
- `tests/unit/features/typing/grade-typing-answer.test.ts` (mới)
- KHÔNG đụng: gemini-provider/gemini-retry-policy (chỉ import hằng số), env, DB, UI, migration, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: gradeTypingAnswer + checkAnswerWithAI (ngắn — kèm ngưỡng local + prompt AI + batch hay không)
Verification: npm run check (lint/typecheck/unit/build), vitest typing N passed, git diff --check
Safety: migrations/DB NO · deps NO (dùng @google/genai có sẵn) · env NO (GEMINI_API_KEY đã có) · AI: dùng Gemini có sẵn · production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- **KHÔNG gọi AI khi local đúng** — đây là yêu cầu chấm trước, AI chỉ dò câu sai
- Tái sử dụng pattern `gemini-provider.ts` — đọc kỹ trước khi viết adapter
- Batch (nếu chọn): tối đa 10 câu/lần gọi, mỗi lần vẫn 1 attempt; thiết kế schema response cho mảng
- AI chỉ nhận đáp án (text) — không gửi thông tin nhạy cảm khác; không log nội dung
- Ngưỡng local giữ nguyên (0.8 / 0.85) — bước AI là lớp an toàn cho câu local chấm sai
