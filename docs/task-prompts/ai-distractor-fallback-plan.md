# Flashcard Runner V1 — AI distractor fallback (plan note)

> **Status:** backlog — quyết định sản phẩm đã chốt (2026-08-14), chưa lên lịch thực hiện
> **Dependency:** sau Task 3 (setup Runner) — bước lọc thẻ tạm thời trong Task 3 sẽ được bỏ khi task này xong
> **Agent tier (dự kiến):** OpenCode (chính) + Terra (bắt buộc — migration, security, cost)

## Quyết định sản phẩm đã chốt (user)

1. Khi một thẻ không đủ 2 đáp án sai khác nhau trong thư viện → **AI sinh đáp án nhiễu tương tự đáp án đúng**, đáp án nhiễu phải **có ý nghĩa** (không bịa vô nghĩa).
2. Áp dụng cho **cả Flashcard Runner và Trắc nghiệm truyền thống**.
3. **Deterministic-first:** chỉ gọi AI khi thư viện thiếu đáp án; ưu tiên đáp án sai có sẵn.
4. Trắc nghiệm: **giữ nguyên hành vi hiện tại (2–4 lựa chọn)**, AI chỉ bù khi thiếu — không nâng chuẩn lên 4 lựa chọn mọi lúc.
5. **Chấp nhận gửi nội dung thẻ (front/back) tới Gemini** để sinh đáp án nhiễu.

## Hệ quả với code/doc hiện tại (cần xử lý trong task này)

- **Thay thế quy tắc đang đóng băng:** `docs/LEARNING_MODES.md` + migration Task 1 đang ghi "không bao giờ bịa đáp án; thiếu thì fail toàn bộ load". Task AI này sẽ sửa doc + migration cho khớp quyết định mới. Không sửa migration cũ — tạo migration mới.
- **Cần lưu trữ đáp án nhiễu do AI sinh** (không sinh lại mỗi lần chơi):
  - Quiz: đã có sẵn `quiz_questions` snapshot (lưu choices) — chỉ cần bổ sung nguồn distractor.
  - Runner: session hiện chỉ snapshot card IDs (`runner_sessions` + coverage) — **cần migration mới** để lưu choices/đáp án nhiễu theo session (hoặc bảng mới), vì `load_runner_session_questions` hiện fail khi không đủ 3 lựa chọn.
- **Hạ tầng Gemini đã có sẵn** trong `src/features/imports/adapters/` (`gemini-provider.ts`, `gemini-retry-policy.ts`, `gemini-classifier.ts`) — tái sử dụng, không xây mới; tuân theo giới hạn/caps hiện có (GEMINI_MAX_*, retry policy).
- **Task 3 tạm thời:** lọc thẻ thiếu đáp án + thông báo; khi task này xong, bỏ bước lọc, thẻ nào cũng tạo được câu hỏi 3 lựa chọn.

## Cập nhật 2026-08-14 — Runner: Task B (scope distractor) làm TRƯỚC task AI này

User đã chốt (task `capy-runner-task-b-scope-distractors.md`): distractor của Runner lấy **từ các câu khác trong chính phiên** (không phải toàn bộ thư viện), deterministic seeded, mỗi câu hỏi có bộ distractor khác nhau. Hệ quả với plan này:

- **Runner:** nguồn distractor đã đổi sang scope phiên → bài toán "thư viện thiếu đáp án" của Runner đổi thành "phiên thiếu ≥2 thẻ khác có back khác" — cơ chế eligibility (ẩn thẻ + thông báo) xử lý deterministic, nên **AI fallback cho Runner có thể không còn cần thiết** (bỏ bước lọc tạm trong Task 3 vẫn phụ thuộc quyết định này khi task AI tới).
- **Quiz (Trắc nghiệm):** plan này vẫn còn nguyên giá trị — Quiz chưa đổi nguồn distractor; AI bù khi thiếu vẫn là hướng đã chốt.
- Khi làm task AI: cập nhật lại phần "Runner" của plan này cho khớp Task B (nếu Runner giữ scope-distractor, AI chỉ còn áp dụng Quiz).

## Điểm thiết kế cần chốt khi làm task này (gợi ý, chưa phải quyết định)

- Thời điểm sinh: lúc tạo session, gộp batch nhiều câu trong 1 lần gọi (giảm latency/quota) — kiểm tra batch tối đa như imports.
- "Có ý nghĩa" kiểm chứng thế nào: heuristic deterministic (khác nhau sau chuẩn hóa, không trùng đáp án đúng, độ dài/từ khoá tương tự) — tránh phụ thuộc AI judge.
- AI lỗi/hết quota → fallback: quay lại deterministic (ít lựa chọn hơn) hay không tạo được phiên — cần chốt.
- Cache/idempotency: sinh lại khi nào (mỗi session mới?) — liên quan chi phí.
- Quiz: RPC `create_quiz_session` hiện cho 2–4 choices — sửa theo hướng "bù AI khi < 2 wrong" mà không đổi luồng người dùng.

## Phạm vi KHÔNG làm

- Không đổi cách ghép lựa chọn/vòng lặp game (vẫn deterministic).
- Không dùng AI cho gameplay Runner (chỉ sinh distractor lúc tạo session).
