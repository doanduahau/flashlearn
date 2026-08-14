# docs/task-prompts/

Thư mục lưu **prompt giao việc cho agent** (không phải tài liệu kỹ thuật, không phải code).

## Mục đích

- Có lịch sử version cho từng prompt (mỗi lần sửa = file mới hoặc cập nhật có ghi chú).
- Khi cần giao lại cho agent (OpenCode / Codex / Luna), chỉ cần lấy file, không phải lục chat.
- Ghi lại các quyết định sản phẩm đã chốt kèm theo từng task.

## Chính sách model (cập nhật 2026-08-14)

> OpenCode + DeepSeek V4 Pro tạm dừng làm agent chính (quota tuần cạn). Codex là chủ lực; **DeepSeek V4 Flash (free) là lựa chọn rẻ cho task nhẹ–vừa**; Pro quay lại khi quota hồi phục.

| Việc                                                                                | Model                                                                                                |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Triển khai feature vừa–khó                                                          | **Codex + GPT-5.6 Terra**                                                                            |
| Triển khai feature nhẹ–vừa, ít rủi ro (UI/docs/test cơ học, không chạm DB/security) | **OpenCode + DeepSeek V4 Flash (free)** — ưu tiên dùng để tiết kiệm Codex                            |
| Review độc lập (DB/security/concurrency/architecture-sensitive)                     | **Codex + GPT-5.6 Sol** — vì Terra là người làm, review độc lập nhích lên Sol để tránh tự làm tự xem |
| Rất khó / rủi ro cao, Terra không đủ chắc                                           | Codex + GPT-5.6 Sol                                                                                  |
| Việc nhẹ: docs, test đơn giản, chỉnh cơ học, kiểm tra nhỏ                           | GPT-5.6 Luna / DeepSeek V4 Flash                                                                     |
| Dự phòng khi quota Codex cạn                                                        | OpenCode + DeepSeek V4 Pro (khi quota hồi phục)                                                      |

Hệ quả vận hành:

- Quota Codex là nút thắt → hạn chế vòng review không cần thiết; task không đụng DB/security thì không review riêng.
- Review độc lập chỉ dùng khi task chạm DB/security/concurrency HOẶC khi implementation do tier khác làm.
- Task đã `delivered` trước ngày này giữ nguyên tier cũ (vd: Task 4 = OpenCode chính + Terra review bắt buộc).

### Đánh giá model theo báo cáo (tự điều chỉnh)

Sau mỗi evidence report, tôi (điều phối) ghi nhận đánh giá ngắn vào bảng dưới — dựa trên kết quả đối chiếu thực tế với repo (không theo cảm tính):

| Ngày       | Task                                              | Model                         | Đánh giá của tôi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-14 | Task 2 — gameplay core                            | OpenCode Pro                  | Tốt — 47/47 test, code sạch, 1 lỗi nhỏ do prompt (itemSeq mâu thuẫn) đã xử lý đúng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-14 | Task 3 — server wiring                            | OpenCode Pro                  | Tốt — security-critical đúng chuẩn, Terra approve, duy nhất 1 minor (double-click, đặc tính chung repo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-14 | Rebrand                                           | OpenCode Pro                  | Tốt — chủ động dừng push khi vượt phạm vi, báo cáo trung thực; cần bổ sung quyết định (đã chốt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-14 | Task 4 — Canvas gameplay                          | OpenCode Pro                  | Tốt — 96/96 test, engine Task 2 không bị đụng, app-shell refactor tối thiểu đúng yêu cầu, E2E 11/11; 1 flake E2E ngoài phạm vi (study-mode, đã pass khi chạy lại)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-14 | Mascot hệ thống                                   | Codex + Terra (Flash quá tải) | Tốt — 19/19 unit, đúng 4 quyết định đã chốt; xử lý đúng chỗ empty state thật (history chỉ là redirect → đặt vào QuizHistory thay vì sửa file redirect); E2E 152/152                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-14 | Task A — Capy Runner UX                           | Codex + Terra                 | Tốt — 88/88 unit, đúng 4 điểm chốt (100×120 @30%, 4.5/3.2/2.4, bỏ ModeTabs chỉ /runner, rename); engine Task 2 + mode-tabs không đụng; còn chủ động sửa mô tả doc cũ sai                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-14 | Task B — distractor scope                         | Codex + Terra + Sol review    | Tốt — migration đúng chuẩn (3 hàm CREATE OR REPLACE, giữ chữ ký/security/grants); seed theo session+card → mỗi câu distractor khác nhau; chuẩn hóa đồng bộ `'\s+'` 3 hàm (Sol bắt được lỗi double-backslash từ bản nháp); pgTAP 38/38 + toàn bộ 534/534 (tôi chạy lại), unit 88/88, E2E 6/6, npm run check PASS                                                                                                                                                                                                                                                                                                                             |
| 2026-08-14 | Task C — jump + HUD + bottom label                | Codex + Terra                 | Tốt — GRAVITY 0.0008 đúng, engine Task 2 không đụng (0 dòng diff), helper co chữ thuần có test; unit 97/97 (tôi chạy lại), check PASS (1076/7); 7 file đúng scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-14 | Task 5 — result + best-time                       | Codex + Terra + Sol review    | Tốt — đúng thứ tự RPC bắt buộc (complete coverage → submit best), game-over không gọi RPC, guard refs chống double-submit Strict Mode, dùng elapsedMs chính xác (không floor), retry phân biệt coverage/best đúng, replay giữ source + chặn double-click; unit 105/105 (tôi chạy lại), check PASS (1084/7, build OK), E2E runner-gameplay 5/5 (tôi chạy lại); 12 file đúng scope; giới hạn E2E deterministic cho Canvas được báo trung thực (completion/replay test qua component tests)                                                                                                                                                    |
| 2026-08-14 | CapyStudy Task 1 — brand màu + logo + memory tile | Codex + Terra                 | Tốt — palette đúng 8 token đã chốt + shadow ấm, màu chức năng giữ nguyên (chỉ còn #65be91 ở success/mastery/burst — đúng); Leaf sạch khỏi src (grep rỗng), logo thay ở đủ 6 chỗ + memory tile h-4/5 w-4/5 object-contain; confetti đổi cam hợp lý; unit 151/151 (tôi chạy lại), check PASS (1084/7, build OK), E2E memory+foundation+runner-setup 25/25 (tôi chạy lại); 11 file đúng scope; 8 warning <img> mới (pre-existing pattern, chấp nhận)                                                                                                                                                                                           |
| 2026-08-14 | CapyStudy Task 2 — mascot 7 trạng thái app-wide   | Codex + Terra                 | Tốt — đủ 7 trạng thái đúng chốt: normal cạnh logo app-shell desktop+mobile (level từ levelFromStreak(streak) có sẵn, không query mới), happy/sad quiz result theo 60%, sad error/404/auth-error, congrats match/memory completion, thinking khắp empty states + import pending, point-right dashboard giữ nguyên (study setup dùng thinking ở empty state — nằm trong quyền chọn của prompt §1.5); import success xử lý đúng theo flow redirect có sẵn (không tạo state mới); module mascot không đụng; unit 92/92 (tôi chạy lại), check PASS (1084/7, build OK), E2E quiz-result+study+foundation 29/29 (tôi chạy lại); 20 file đúng scope |

→ Nếu Flash làm task nhẹ–vừa nhiều lần mà chất lượng ổn định (không cần sửa nhiều, không sót gate), tôi sẽ nâng mức task giao cho Flash; nếu chất lượng kém (thiếu test, vượt scope, báo cáo sai) → hạ xuống chỉ làm việc cơ học.

## Hàng đợi hiện tại (2026-08-14)

### UX overhaul 2026-08-14 — nhóm mới (chốt 7 quyết định, xem metadata Task 1)

| Task                                                                                            | File                                            | Trạng thái                                                                                                              | Tier                                                             |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Task 1 — thứ tự thời gian + định nghĩa "câu sai"                                                | `capystudy-task-1-sort-and-wrong-definition.md` | ✅ verified + pushed `fd0ad59` + migration `20260814020000` applied production                                          | Codex + Terra → Sol review (APPROVE)                             |
| Task 2 — /sets 2 thẻ lớn + bỏ review                                                            | `capystudy-task-2-sets-redesign.md`             | ✅ verified `7d8b995` — commit xong, chờ push (kèm cleanup dead code)                                                   | DeepSeek Flash Free, không review riêng                          |
| Task 2b — /sets launcher 2 thẻ + /sets/create + /sets/library                                   | `capystudy-task-2b-sets-launcher.md`            | ✅ verified + pushed `4f6effd` + fix `0c27901` (2 thẻ gọn 1 màn)                                                        | DeepSeek Flash Free, không review riêng (E2E bắt buộc)           |
| Task 2c — preview thẻ sửa được (dưới nút Tạo) + GS luôn hiện chọn cột + xóa bộ về /sets/library | `capystudy-task-2c-import-preview-edit.md`      | delivered — chờ giao                                                                                                    | Codex + Terra, không review riêng (đụng luồng import dùng chung) |
| Task 3 — trang Học: điều hướng /study/mode (3 thẻ) + filter tự động                             | `capystudy-task-3-study-modes.md`               | ✅ verified `1d60a6c` — chờ Sol review + push                                                                           | Codex + Terra → Sol review                                       |
| Task 4 — trang Kiểm tra: /quiz/mode (2 thẻ) + lịch sử vào Thống kê                              | `capystudy-task-4-quiz-redesign.md`             | delivered — ✅ đã sửa theo pattern launcher (trang riêng)                                                               | Codex + Terra → Sol review                                       |
| Task 5 — thoát + xác nhận + pause tab ẩn                                                        | `capystudy-task-5-exit-confirm-pause.md`        | delivered — chờ giao                                                                                                    | Codex + Terra, không review riêng                                |
| Task 6a — header gọn + dời Đăng xuất vào Cá nhân                                                | `capystudy-task-6a-header.md`                   | ✅ verified + pushed `353cc4d`                                                                                          | Gemini, không review riêng                                       |
| Task 6b — study nút Trước/Sau không đè thẻ                                                      | `capystudy-task-6b-study-buttons.md`            | ✅ verified + pushed `5a238e3`                                                                                          | Gemini, không review riêng                                       |
| Task 6c — Match 12 ô cố định 6×2 + co chữ                                                       | `capystudy-task-6c-match-board.md`              | ✅ verified + pushed `32ec2d1`                                                                                          | Gemini, không review riêng                                       |
| Task 7 — mascot level theo streak ở mọi nơi (trừ 3 trang lỗi)                                   | `capystudy-task-7-mascot-level-consistency.md`  | delivered — **chờ giao SAU Task 5** (đụng file chung study-source-select/source-browser/quiz-page/match-memory-session) | Gemini, không review riêng (E2E bắt buộc)                        |

### Đã hoàn thành trước đó

| Task                                              | File                                     | Trạng thái                     | Tier                              |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------ | --------------------------------- |
| Task 5 — result + best-time                       | `capy-runner-task-5-result-best-time.md` | ✅ verified + pushed `1543edf` | Codex + Terra → Sol review        |
| CapyStudy Task 1 — brand màu + logo + memory tile | `capystudy-task-1-brand-color-logo.md`   | ✅ verified + pushed `3973e74` | Codex + Terra, không review riêng |
| CapyStudy Task 2 — mascot 7 trạng thái app-wide   | `capystudy-task-2-mascot-appwide.md`     | ✅ verified + pushed `b22d218` | Codex + Terra, không review riêng |

## Quy ước

- **Tên file:** `<feature>-task<N>-<slug>.md` — ví dụ `flashcard-runner-task2-gameplay-core.md`.
- **Mỗi file bắt đầu bằng block metadata:**
  - `Status`: `draft` → `reviewed` → `delivered` → `verified`
  - `Baseline commit` (commit gốc agent phải bắt đầu từ)
  - `Agent tier` (OpenCode / Terra / Sol / Luna)
  - `Decisions locked` (các quyết định sản phẩm đã chốt cho task này)
  - `Doc sync` (tài liệu nào đã được cập nhật kèm task, nếu có)
- **Không sửa file đã `delivered`** — tạo bản mới (`-v2`, `-v3`, ...) nếu prompt thay đổi.
- Sau khi agent xong và được kiểm soát chất lượng, cập nhật `Status: verified` (không sửa nội dung prompt).

## Vòng đời

```text
draft (tôi soạn, có thể sửa nhiều lần)
  → reviewed (bạn duyệt)
  → delivered (bạn copy giao cho agent)
  → verified (agent xong + tôi đối chiếu với repo)
```

## Ghi chú

- Prompt phải luôn kèm: scope, frozen rules, verification gates, evidence report template.
- Nếu prompt chạm quyết định sản phẩm chưa chốt → hỏi user kèm đề xuất trước khi `reviewed`, không tự quyết.
