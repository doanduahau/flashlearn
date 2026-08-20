# CapyStudy Phase 15-task — Delivery Pack (prompt giao việc + câu chốt push + test production)

> **Cách dùng:** với mỗi task, copy khối **GIAO** gửi cho implementer (DeepSeek Flash). Task chạm DB có thêm khối **REVIEW** gửi cho Gemini trước khi nhận evidence. Sau khi tôi (coordinator) verify evidence → copy khối **CHỐT PUSH** chạy. Xong push → làm theo **TEST PRODUCTION**.
>
> **Baseline:** khi giao, thay `[BASELINE]` bằng commit đã push gần nhất (chạy `git log --oneline -1`). Hiện tại: `bc6e71c`.
>
> **AI typing (đã chốt):** chấm 2 bước — local trước → câu SAI gọi Gemini dò (giống nghĩa + cùng ngôn ngữ → đúng). TÁI SỬ DỤNG hạ tầng Gemini có sẵn (`GEMINI_API_KEY` + `@google/genai` + `gemini-provider.ts` pattern, model `gemini-flash-lite-latest`, retry 1). 3 chế độ kiểm tra (quiz+match+typing) đối xử: câu sai / chưa làm / tỉ lệ chính xác gộp chung (`mode_answer_events` đưa lên N8).
>
> **Quy trình:** giao → nhận evidence → tôi đối chiếu (git + db:test + npm run check) → duyệt → bạn chạy CHỐT PUSH → test production → giao task kế.
>
> **Thứ tự:** N1 → N2 → N3 → N4 → N5 → N6 → N7 → N8 (DB) → N9 → N10 → N11 → N12 (DB) → N13 → N14 (DB) → N15. Task ghi "phụ thuộc" phải chờ task trước verified + push.

---

## N1 — Sheets + Excel chọn cột mặt trước/mặt sau bất kỳ

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n1-column-mapping.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push, main đồng bộ origin/main). KHÔNG push — tạo 1 commit `feat: allow picking any front/back column for sheets and excel` rồi gửi evidence report (kèm trích code meaningfulColumns + options mới ngắn gọn)."

**CHỐT PUSH:**

> Task N1 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận main đồng bộ origin/main (0 ahead). Không có migration kèm theo. Báo kết quả push.

**TEST PRODUCTION:**

1. Vào `/sets/create?source=file` → chọn file Excel (xlsx/csv) → thấy dropdown "Mặt trước" + "Mặt sau" hiển thị tên cột **A, B, C...** (kể cả cột không có header) → chọn vd mặt trước = C, mặt sau = B → preview + số thẻ đổi theo ngay (không cần bấm lại)
2. Vào Google Sheets (`/sets/create?source=google_sheets`) → chọn bảng có ≥3 cột → chọn mặt trước = cột 3, mặt sau = cột 2 → preview đổi theo (sau ~250ms)
3. Tạo bộ → vào `/sets/[setId]` → thẻ đúng front = cột 3, back = cột 2

---

## N2 — Card chọn chế độ gọn 120px mobile (/study/mode + /quiz/mode)

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n2-mode-card-compact.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `feat: compact mode selection cards on mobile` rồi gửi evidence report (kèm trích cấu trúc card mới ngắn gọn)."

**CHỐT PUSH:**

> Task N2 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. Mobile (mở DevTools 390px hoặc điện thoại): `/study` → chọn nguồn → "Bắt đầu học" → 3 card (Lật thẻ / Memory / Capy runner) mỗi card **cao ~120px**, mascot to bên trái (~30%), nút "Bắt đầu" bên phải
2. `/quiz` → "Bắt đầu kiểm tra" → 2 card (Trắc nghiệm / Match) cùng layout gọn
3. Bấm "Bắt đầu" Memory/Runner → vẫn hiện chọn số câu + độ khó (không vỡ); card nào thiếu thẻ vẫn disabled + thông báo "Cần tối thiểu N thẻ"
4. Desktop: layout đọc thoải mái, không vỡ

---

## N3 — Runner: thức ăn bay trên cao, nhảy chạm = ăn, nhanh hơn

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n3-runner-sky-mechanic.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `feat: rework runner to catch food in the sky` rồi gửi evidence report (kèm PHYSICS: GRAVITY/JUMP_VELOCITY/thời gian bay/đỉnh nhảy/skyLevel/timePerItemMs mới + trích code vị trí food + jump loop ngắn gọn)."

**CHỐT PUSH:**

> Task N3 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. `/study/mode` → Capy runner → chọn số câu + độ khó → "Bắt đầu"
2. Quan sát: thức ăn (đĩa tròn) bay ngang **ở phía trên màn hình**; mascot chạy ở dưới
3. **Nhấn space/chạm để nhảy lên** — chạm thức ăn = ăn được (đúng) + phản hồi màu xanh + mascot happy; không nhảy → thức ăn bay qua → chuyển đáp án
4. Cảm giác **chạy nhanh hơn** trước; nhảy lên + rơi xuống **nhanh hơn** trước (không lơ lửng lâu)
5. Độ khó Dễ/Vừa/Khó vẫn khác nhau (tốc độ + số mạng); HUD, màn kết thúc, kỷ lục thời gian hoạt động bình thường

---

## N4 — Bỏ chip "Nguồn đã chọn" + nút thoát sets/library → /sets, bộ → /sets/library

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n4-source-chip-and-back-nav.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `fix: remove selected-source chip bar and simplify set back navigation` rồi gửi evidence report (kèm trích khối xóa + fallbackHref mới ngắn gọn)."

**CHỐT PUSH:**

> Task N4 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. `/study` hoặc `/quiz`: tick nguồn → **không còn** dải chip cam "Nguồn đã chọn" phía trên; nguồn vẫn tick được (ô nguồn sáng lên) + thanh dưới vẫn hiện "N nguồn · X thẻ"
2. `/sets/library` → nút `← Thoát` → về **`/sets`** (trang 2 thẻ launcher)
3. Mở 1 bộ `/sets/[setId]` → nút `← Thoát` → về **`/sets/library`**
4. Luồng tạo bộ (create), đổi tên, xóa bộ vẫn hoạt động; xóa bộ → về `/sets/library` (đã đúng từ trước — verify lại)

---

## N5 — Flashcard Wheel (lật thẻ vòng cuộn dọc)

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n5-flashcard-wheel.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `feat: redesign study session as a flashcard wheel` rồi gửi evidence report (kèm trích container wheel + active index ngắn gọn)."

**CHỐT PUSH:**

> Task N5 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. Mobile: `/study` → chọn bộ → "Bắt đầu học" → Lật thẻ → mở `/study/session`
2. **Vuốt lên** → thẻ tiếp theo; **vuốt xuống** → thẻ trước; thả tay → thẻ **snap vào giữa** (có quán tính mượt)
3. Thẻ giữa **to rõ**, thẻ trên/dưới **nhỏ mờ** (cảm giác dòng thẻ liên tục)
4. **Chạm vào thẻ giữa** → lật mặt trước/sau; chạm thẻ khác → cuộn tới thẻ đó
5. Thanh tiến độ "N / total" hoạt động; thẻ cuối → nút "Hoàn thành" → màn hoàn thành
6. Desktop: scroll chuột cuộn dọc + click lật; không có thanh cuộn ngang; nút Trước/Sau cũ không còn
7. Keyboard: Space lật, ArrowUp/ArrowDown đổi thẻ

---

## N6 — Kết thúc học/chơi theo style Capy runner (lật thẻ + memory + match)

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n6-runner-style-end.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `feat: align learning completion screens with runner style` rồi gửi evidence report (kèm trích khối done của 1 mode ngắn gọn)."

**CHỐT PUSH:**

> Task N6 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. Học → Lật thẻ → xem hết → "Hoàn thành" → màn: mascot congrats **to (144px)**, "Hoàn thành!", "Đã xem N thẻ", nút "Chơi lại" (soft) + `← Thoát`
2. Học → Memory matching → hoàn thành → màn tương tự (mascot to + nút)
3. Kiểm tra → Match → hoàn thành → màn tương tự; nếu lưu kết quả lỗi → vẫn thấy "Thử lại lưu kết quả"
4. Kiểm tra → Trắc nghiệm → kết quả **GIỮ NGUYÊN** (mascot happy/sad theo điểm + Chơi lại/Quay lại — không đổi)
5. So sánh: 3 màn (lật thẻ/memory/match) đồng nhất style, giống Capy runner

---

## N7 — Hồ sơ: dàn mascot cột mốc streak

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n7-profile-milestones.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `feat: show streak milestone mascots on profile` rồi gửi evidence report (kèm trích component milestone-mascots ngắn gọn)."

**CHỐT PUSH:**

> Task N7 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. `/profile` → tab "Hồ sơ" → thấy section **"Cột mốc streak"** với 5 mascot đều trạng thái **happy**
2. Dưới chân các mascot level 2–5: số **30 🔥 / 60 🔥 / 120 🔥 / 240 🔥**; level 1 không số
3. Mascot tương ứng streak hiện tại: **96×96 rõ nét**; các mốc chưa đạt: **64×64 mờ + trắng đen**
4. Streak 0 (chưa có): chỉ level 1 rõ, 4 con kia mờ
5. Mobile: 5 mascot xếp gọn, không tràn ngang

---

## N8 — Typing DB (typing_attempts + mode_answer_events + 2 RPC + coverage typing) — ⚠️ CHẠM DB

**GIAO (DeepSeek Flash — implementer):**

> "Đọc `docs/task-prompts/capystudy-task-n8-typing-db.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). Task kèm **1 migration mới** (`20260816160000_typing_attempts.sql` — **2 bảng** `typing_attempts` + `mode_answer_events` + **2 RPC** `save_typing_attempt` + `record_mode_answers` + mở rộng coverage mode 'typing') + pgTAP `033` (cover cả 2 bảng + 2 RPC). Chạy `npx supabase db reset` TRƯỚC `npm run db:test`. KHÔNG push — tạo 1 commit `feat: add typing attempt persistence and mode answer events` rồi gửi evidence report. **Bắt buộc: Gemini review APPROVE trong report trước khi gửi.**"

**REVIEW (Gemini — trước khi nhận evidence):**

> "Review độc lập `supabase/migrations/20260816160000_typing_attempts.sql` + `supabase/tests/033_typing_attempts.sql` của Task N8, đối chiếu mục 3 trong `docs/task-prompts/capystudy-task-n8-typing-db.md`. Kiểm tra: (1) 2 bảng đủ cột + check constraint; (2) RLS + policy select_own + revoke/grant (authenticated select-only, service_role all); (3) RPC `save_typing_attempt` + `record_mode_answers` SECURITY DEFINER + empty search_path + validation (42501/22023, batch ≤ 200, mode ∈ match/typing) + grant service_role only; (4) coverage mode 'typing' mở rộng đúng (additive, không vỡ mode cũ); (5) pgTAP cover đủ 8 nhóm test. Ghi `APPROVE` hoặc `REJECT` kèm findings (file:line)."

**CHỐT PUSH + MIGRATION PRODUCTION:**

> Task N8 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> npx supabase migration list    # xác nhận 20260816160000 pending
> npx supabase db push
> ```
>
> Xác nhận 0 ahead + migration applied. Báo kết quả push.

**TEST PRODUCTION:**

1. (UI chưa có — task này chỉ DB) SQL editor Supabase: `select * from public.typing_attempts limit 1` → bảng tồn tại; `select proname from pg_proc where proname='save_typing_attempt'` → RPC tồn tại
2. Kiểm tra grant: `save_typing_attempt` chỉ service_role (không anon/authenticated) — query pg_proc/ACL nếu muốn
3. Chờ N10 để test luồng thật

---

## N9 — Typing chấm 2 bước (local trước + AI Gemini dò câu sai)

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n9-typing-algorithm.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). Tạo: (1) `src/features/typing/utils/answer-match.ts` (normalizeAnswer + isAnswerCorrect + levenshtein — thuần); (2) `src/features/typing/server/gemini-answer-check.ts` (adapter AI — TÁI SỬ DỤNG pattern `gemini-provider.ts`: GoogleGenAI + getGeminiApiKey + model gemini-flash-lite-latest + responseSchema JSON + retry 1, `import \"server-only\"`); (3) `src/features/typing/server/answer-check.ts` (`gradeTypingAnswer` — local đúng → true không gọi AI; local sai → AI dò; AI lỗi/thiếu key → giữ local). Unit test mock AI: local đúng KHÔNG gọi AI; local sai + AI đúng → true; local sai + AI sai → false; AI throw → false. KHÔNG gọi Gemini thật trong test. KHÔNG push — tạo 1 commit `feat: grade typing answers with local matching and ai review` rồi gửi evidence report (kèm ngưỡng local + prompt AI + batch hay không)."

**CHỐT PUSH:**

> Task N9 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. Không có UI riêng — kiểm chứng qua unit test (agent đã chạy) + N10 sau này
2. Có thể viết test nhanh trong code nếu muốn xem hành vi: "xin chao" vs "xin chào" → đúng; "con chó" vs "con mèo" → sai

---

## N10 — Typing UI (thẻ thứ 3 /quiz/mode + session + kết quả) — phụ thuộc N8 + N9

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n10-typing-ui.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push — đã gồm N8+N9). Dùng RPC `save_typing_attempt` + `record_mode_answers` (N8) + `gradeTypingAnswer` (N9 — chấm 2 bước local→AI, AI chỉ dò câu sai). **Bắt buộc: mở rộng `loadWrongAnswerCardIds` gộp 3 chế độ (quiz_questions + mode_answer_events — latest answer per card) — để typing/quiz/match đối xử câu sai.** E2E mock AI (không gọi Gemini thật). KHÔNG push — tạo 1 commit `feat: add typing quiz mode with answer matching` rồi gửi evidence report (kèm trích startTypingSession + nộp bài 2 bước + loadWrong mở rộng ngắn gọn)."

**CHỐT PUSH:**

> Task N10 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration (dùng RPC N8 đã apply). Báo kết quả push.

**TEST PRODUCTION:**

1. `/quiz` → chọn nguồn → "Bắt đầu kiểm tra" → thấy **3 card**: Trắc nghiệm / Match / **Nhập đáp án**
2. Card "Nhập đáp án" → chọn số câu (10/20/30/50/Tất cả) → "Bắt đầu"
3. Session: thấy câu hỏi (mặt trước) to giữa + ô nhập đáp án; gõ đáp án → nút "Câu sau" → sang câu tiếp; "Câu trước" quay lại sửa được
4. Làm hết → nút "Nộp bài" → kết quả: mascot happy/sad theo điểm + "X/Y đúng (Z%)" + review từng câu (Đáp án của bạn / Đáp án đúng + badge Đúng/Sai)
5. Thử: nhập đúng → đúng; nhập thiếu dấu ("xin chao" cho "xin chào") → vẫn đúng; nhập sai nghĩa → sai
6. Nút "Chơi lại" → session mới cùng cấu hình; "Quay lại" → /quiz/mode
7. Thoát giữa chừng → confirm; tab ẩn → pause
8. Kiểm tra DB: `select * from typing_attempts order by completed_at desc limit 3` → có row mới đúng total/correct

---

## N11 — Thống kê cá nhân (gọn + bỏ mục + lịch sử 3 chế độ ẩn) — phụ thuộc N8

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n11-statistics-refresh.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). Lịch sử gộp quiz_sessions + match_attempts + typing_attempts (N8 đã có). KHÔNG push — tạo 1 commit `feat: refresh profile statistics with hidden multi-mode history` rồi gửi evidence report (kèm trích cards gọn + history merge ngắn gọn)."

**CHỐT PUSH:**

> Task N11 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. `/profile` → tab "Thống kê" → 6 thông số **2 cột trên 1 dòng** (mobile cũng 2 cột), chữ nhỏ gọn hơn
2. **Không còn** mục "Theo chế độ" + "Bài gần đây"
3. Lịch sử bài kiểm tra: **không hiện list dài** — chỉ thấy tổng số bài + nút "Xem lịch sử"
4. Bấm "Xem lịch sử" → trang `/profile?tab=statistics&view=history` hiện **toàn bộ lịch sử 3 chế độ** (Trắc nghiệm + Match + Nhập đáp án) sort mới nhất trước, mỗi dòng **"10/10 đúng"** (KHÔNG có chữ "Cân bằng") + ngày giờ
5. Quiz dòng có link vào trang kết quả; match/typing hiện thông tin (không link — ghi rõ nếu vậy)
6. Refresh trang ở view=history → vẫn giữ

---

## N12 — Streak mọi chế độ (record_daily_activity + gọi khi hoàn thành + refresh ngay) — ⚠️ CHẠM DB, phụ thuộc N8 + N10

**GIAO (DeepSeek Flash — implementer):**

> "Đọc `docs/task-prompts/capystudy-task-n12-streak-all-modes.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push — gồm typing). Task kèm **1 migration mới** (`20260816170000_record_daily_activity.sql` — RPC `record_daily_activity` service_role only) + pgTAP `034` + gọi RPC khi hoàn thành match/typing/memory/runner/study + server action chung + `router.refresh()` cập nhật streak ngay. Chạy `npx supabase db reset` TRƯỚC `npm run db:test`. KHÔNG push — tạo 1 commit `feat: record daily activity for every learning mode` rồi gửi evidence report. **Bắt buộc: Gemini review APPROVE trong report trước khi gửi.**"

**REVIEW (Gemini — trước khi nhận evidence):**

> "Review độc lập `supabase/migrations/20260816170000_record_daily_activity.sql` + `supabase/tests/034_daily_activity.sql` của Task N12, đối chiếu mục 3 trong `docs/task-prompts/capystudy-task-n12-streak-all-modes.md`. Kiểm tra: (1) RPC SECURITY DEFINER + empty search_path + grant service_role only; (2) mode ∈ ('quiz','match','typing','memory','runner','study'), ngoài → 22023; (3) timezone/local_date mirror đúng submit_quiz_answer; (4) quiz/match/typing tăng completed_quiz_count + questions + correct; memory/runner/study chỉ đảm bảo record (không tăng count); (5) upsert không trùng row + clamp correct ≤ questions; (6) pgTAP cover đủ 7 nhóm. Ghi `APPROVE` hoặc `REJECT` kèm findings (file:line)."

**CHỐT PUSH + MIGRATION PRODUCTION:**

> Task N12 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> npx supabase migration list    # xác nhận 20260816170000 pending
> npx supabase db push
> ```
>
> Xác nhận 0 ahead + migration applied. Báo kết quả push.

**TEST PRODUCTION:**

1. Kiểm tra streak tăng khi: hoàn thành 1 ván **Match** → mở `/dashboard` thấy streak/hoạt động hôm nay cập nhật **KHÔNG cần reload** (quay lại là thấy)
2. Tương tự: hoàn thành **Nhập đáp án**, **Memory**, **Capy runner**, **Lật thẻ** (xem hết + Hoàn thành) → tất cả tính streak trong ngày
3. "Bài hôm nay" chỉ đếm **3 chế độ kiểm tra** (quiz + match + typing), không đếm memory/runner/lật thẻ — kiểm tra dashboard
4. Làm nhiều bài cùng ngày → streak chỉ +1 ngày (không cộng dồn)
5. SQL: `select * from daily_learning_records order by local_date desc limit 3` — record hôm nay tồn tại, completed_quiz_count tăng theo bài kiểm tra

---

## N13 — Streak khôi phục (gap 1 ngày + 3 bài kiểm tra) — phụ thuộc N12

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n13-streak-recovery.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push — gồm N12). Logic mới trong `computeStreaks` (recoverable/needsRecoveryQuizzes) + `loadStreakSummary` (todayQuizCount) + message dashboard. KHÔNG push — tạo 1 commit `feat: allow streak recovery after a one-day gap` rồi gửi evidence report (kèm bảng case recovery + trích code ngắn gọn). Nếu phải đổi RPC `get_learning_statistics` → bắt buộc Gemini review + ghi rõ."

**REVIEW (Gemini — CHỈ khi đổi RPC):**

> "Review migration/RPC mới (nếu có) của Task N13 theo mục 3 trong `docs/task-prompts/capystudy-task-n13-streak-recovery.md`. Ghi `APPROVE` hoặc `REJECT` kèm findings."

**CHỐT PUSH (+ MIGRATION nếu có):**

> Task N13 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> # chỉ khi có migration mới:
> npx supabase migration list
> npx supabase db push
> ```
>
> Xác nhận 0 ahead (+ migration applied nếu có). Báo kết quả push.

**TEST PRODUCTION:**

1. **Kịch bản hồi:** có streak (vd 5 ngày) → **nghỉ 1 ngày** (không làm gì) → hôm sau mở `/dashboard` → thấy message **"Làm 3 bài chế độ kiểm tra để khôi phục streak"** (thay cho "Chưa làm bài hôm nay") — streak KHÔNG về 0
2. Hôm sau làm **1–2 bài kiểm tra** → vẫn thấy message hồi (thiếu bài); streak hiển thị giá trị cũ
3. Hôm sau làm **đủ 3 bài kiểm tra** (vd 3 bài Trắc nghiệm, hoặc 1 trắc + 1 match + 1 typing) → **streak nối tiếp** (vd 5 → 6), ngày nghỉ KHÔNG tính; message hồi biến mất
4. **Nghỉ 2 ngày liên tiếp** → streak **mất hẳn về 0** (không có message hồi)
5. Bình thường (không gap): dashboard hiển thị như cũ

---

## N14 — Dashboard gộp 3 chế độ (cần ôn/chưa học) + Match ghi per-card — KHÔNG chạm DB (dùng N8)

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n14-dashboard-all-modes.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push — gồm N8 bảng `mode_answer_events` + N10 loadWrong gộp 3 chế độ + N12). KHÔNG có migration mới — dùng RPC `record_mode_answers` (N8): match ghi per-card events khi hoàn thành + dashboard counts (cần ôn = latest-wrong, chưa học = chưa xuất hiện). KHÔNG push — tạo 1 commit `feat: aggregate dashboard metrics across quiz modes` rồi gửi evidence report (kèm trích match per-card + dashboard counts ngắn gọn)."

**CHỐT PUSH + MIGRATION PRODUCTION:**

> Task N14 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> npx supabase migration list    # xác nhận 20260816180000 pending
> npx supabase db push
> ```
>
> Xác nhận 0 ahead + migration applied. Báo kết quả push.

**TEST PRODUCTION:**

1. `/dashboard` → **Độ chính xác + Bài hôm nay** phản ánh cả 3 chế độ (làm 1 trắc + 1 match → số bài = 2, độ chính xác gộp cả 2)
2. **Cần ôn:** trả lời SAI 1 câu ở typing (hoặc ghép sai ở match) → mở dashboard → "Cần ôn" tăng theo số thẻ sai
3. **Chưa học:** thẻ chưa từng xuất hiện ở bất kỳ chế độ → đếm vào "Chưa học"; sau khi thẻ đó xuất hiện (kể cả sai) → hết "chưa học"
4. Thẻ sai ở quiz rồi sau đó đúng ở match → không còn "cần ôn" (latest answer đúng) — nếu agent chọn quy tắc latest; xác nhận theo evidence
5. SQL: `select * from mode_answer_events order by answered_at desc limit 5` — có event match (N14) + typing (N10) sau khi chơi

---

## N15 — Dashboard "Hoạt động tháng này" thêm link xem lịch sử tháng

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-n15-dashboard-month-history.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push). KHÔNG push — tạo 1 commit `feat: link dashboard month activity to history view` rồi gửi evidence report (kèm trích link mới ngắn gọn)."

**CHỐT PUSH:**

> Task N15 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status
> git log --oneline -2
> git push origin main
> ```
>
> Xác nhận 0 ahead. Không migration. Báo kết quả push.

**TEST PRODUCTION:**

1. `/dashboard` → khối "Hoạt động tháng này" → thấy link/icon mới (vd "Xem lịch sử" hoặc mũi tên) cạnh heading
2. Bấm → về `/profile?tab=statistics` (mở đúng tháng đang xem nếu agent truyền ?month=) → thấy calendar full + chuyển tháng được
3. Mobile: link đủ to chạm, không vỡ layout

---

## S8 — Chống clone trùng (đã tham gia lớp học / đã lưu bộ) + lưu nguồn clone — follow-up Phase Sharing

> **Chốt 2026-08-16:** (1) đã tham gia lớp học → bấm "Tham gia lớp học" lần nữa → KHÔNG tạo clone mới, tự điều hướng thẳng tới bộ đã lưu; (2) bộ thường clone trước → chủ bật lớp học sau → KHÔNG backfill, phải bấm "Tham gia lớp học" lại (tạo clone mới + membership); (3) bộ thường lưu 2 lần → chặn + thông báo "Bạn đã lưu bộ này" + link mở bản đã lưu.

**GIAO (DeepSeek Flash):**

> "Đọc `docs/task-prompts/capystudy-task-s8-clone-dedupe.md` và thực hiện đúng toàn bộ nội dung trong file. Bắt đầu từ mục 0. Baseline hiện tại: `[BASELINE]` (đã push, main đồng bộ origin/main, migration S1–S6 đã apply production). Task kèm **1 migration mới** (`20260816165000_clone_dedupe_and_source.sql` — cột `source_share_token` + index + drop+create `clone_shared_set` đổi return type thêm `already_exists boolean` + advisory lock chống race) + **cập nhật pgTAP `030`** (hành vi re-clone thay đổi — bắt buộc) + server action trả `{ setId, alreadyExists }` + button nhánh alreadyExists (classroom → tự điều hướng; regular → thông báo + link). Chạy `npx supabase db reset` TRƯỚC `npm run db:test`. KHÔNG push — tạo 1 commit `feat: prevent duplicate shared set clones with source tracking` rồi gửi evidence report. **Bắt buộc: Gemini review APPROVE trong report trước khi gửi.**"

**REVIEW (Gemini — bắt buộc, chạm DB):**

> "Review độc lập `supabase/migrations/20260816165000_clone_dedupe_and_source.sql` + phần SỬA trong `supabase/tests/030_shared_set_clone.sql` của Task S8, đối chiếu mục 3 trong `docs/task-prompts/capystudy-task-s8-clone-dedupe.md`. Kiểm tra: (1) drop+create đổi return type đúng + restore grants (service_role only, không anon/authenticated); (2) classroom path chỉ check membership (join đảm bảo clone còn tồn tại + thuộc user) — re-clone trả clone cũ + already_exists=true, KHÔNG tạo clone mới, KHÔNG re-point membership; (3) regular path check `source_share_token` (bản sớm nhất) — trả clone cũ + already_exists=true; (4) clone mới luôn set source_share_token; (5) advisory lock chống race; (6) validations cũ (22023/42501/2000 thẻ) giữ nguyên; (7) pgTAP 030 cập nhật đúng (bỏ assert refresh clone_set_id cũ, thêm assert dedupe + source_share_token), plan đếm lại đúng. Ghi `APPROVE` hoặc `REJECT` kèm findings (file:line)."

**CHỐT PUSH + MIGRATION PRODUCTION:**

> Task S8 đã được verify, duyệt push. Thực hiện:
>
> ```bash
> git status          # worktree chỉ còn docs untracked
> git log --oneline -2
> git push origin main
> npx supabase migration list    # xác nhận 20260816165000 pending
> npx supabase db push
> ```
>
> Xác nhận main đồng bộ origin/main (0 ahead) + migration applied. Báo kết quả push.

**TEST PRODUCTION:**

1. Chia sẻ 1 bộ thường (không bật lớp học) → tab ẩn danh mở link → đăng nhập → "Lưu vào bộ của tôi" → về `/sets/[bộ mới]`; mở lại link → bấm "Lưu vào bộ của tôi" lần 2 → **thấy "Bạn đã lưu bộ này"** + nút "Mở bộ flashcard của bạn" → bấm vào → về đúng bộ đã lưu (không tạo bản thứ 2)
2. Bật "Chế độ lớp học" ở bộ đó → mở link → nút đổi thành "Tham gia lớp học" → bấm (lần đầu) → tạo clone mới + thành viên được ghi
3. Bấm "Tham gia lớp học" lần 2 → **tự điều hướng thẳng** tới bộ clone vừa tạo (không thông báo, không bản trùng); kiểm tra thư viện `/sets/library` chỉ có 1 bản (bản lúc đầu + bản lớp học là 2 bộ khác nhau — đúng vì chốt 2)
4. Xóa bản clone lớp học → bấm lại "Tham gia lớp học" → tạo clone mới + membership trỏ lại (khôi phục hợp lý)
5. SQL: `select count(*) from shared_set_memberships where set_id = '<set_id>'` — mỗi học sinh chỉ 1 row dù bấm nhiều lần

---

## Tổng kết sau khi xong 15 task

- Toàn bộ Phase mới hoàn tất: chọn cột import, card gọn, runner mới, wheel, kết thúc style runner, hồ sơ mascot, typing mode (DB+alg+UI), thống kê gọn + lịch sử 3 chế độ, streak mọi chế độ + khôi phục, dashboard gộp 3 chế độ, link lịch sử tháng
- 4 migration mới cần apply production: `20260816165000` (S8 — clone dedupe + source_share_token, giao trước Phase N), `20260816160000` (N8 — typing_attempts + mode_answer_events), `20260816170000` (N12 — record_daily_activity) (+ N13 nếu chạm RPC). N14 KHÔNG có migration (dùng N8)
- Kiểm tra cuối toàn diện: `npm run check` + `npm run db:test` (36+ files) + E2E các spec chạm + test production theo từng task ở trên
- Typing chấm: local trước → AI (Gemini có sẵn) chỉ dò câu SAI; 3 chế độ kiểm tra đối xử (câu sai/chưa làm/tỉ lệ chính xác gộp chung)
