# 14. Decisions & Constraints

> Tổng hợp ADR + các quyết định kiến trúc quan trọng khác có evidence trong code.
> Format: Decision / Context / Made / Why / Consequences / Current validity.

---

## 1. ADR 001 — Core data ownership model (composite ownership FKs)

- **Context:** Mọi dữ liệu thuộc một user; cần chặn cross-user reference ở tầng DB,
  không chỉ RLS.
- **Decision made:** Lưu `user_id` trên `flashcards` và `special_collection_items`;
  dùng composite FKs `(user_id, id)` → parent; parent có `UNIQUE (user_id, id)` làm
  FK target. RLS là access boundary runtime; composite FK là integrity backstop.
- **Why:** Cross-user insertion bất khả thi ngay cả khi RLS bị bypass; cascades nhất quán.
- **Consequences:** `user_id` denormalized (immutable qua RLS `WITH CHECK`); bảng sau
  (quiz, stats…) phải theo pattern tương tự.
- **Current validity:** **Active** — vẫn đúng trong schema hiện tại
  (`flashcards (user_id, set_id)`, `special_collection_items` composite FKs).
- **Nguồn:** `docs/DECISIONS/001-core-data-ownership.md`.

---

## 2. ADR 002 — Free-tier beta deployment

- **Context:** Beta nhỏ, chi phí thấp, vận hành tối thiểu.
- **Decision made:** Vercel Hobby + Supabase Free; email confirmation tắt ở production;
  không SMTP, không password recovery, không lưu file gốc import.
- **Why:** Chi phí 0; setup nhanh; rollback dễ.
- **Consequences:** Email chưa verify; không recovery; dễ spam; quota free-tier giới hạn.
- **Current validity:** **Active** (beta). Lưu ý: email confirmation **bật ở local**
  (`config.toml enable_confirmations = true`) nhưng tắt ở production theo ADR —
  cần kiểm tra lại trạng thái production thực tế (không thể xác minh từ repo).
- **Nguồn:** `docs/DECISIONS/002-free-tier-beta-deployment.md`.

---

## 3. Quiz engine: RPC server-side, snapshot-based

- **Context:** Cần sinh đề ổn định, chống trùng, chấm điểm đáng tin cậy.
- **Decision made:** Toàn bộ tạo đề + chấm điểm nằm trong RPC SQL
  (`create_quiz_session`, `submit_quiz_answer`), không ở client; câu hỏi là snapshot.
- **Why:** Invariant (count khớp, distractor không trùng, ownership) có thể enforce
  trong transaction; client không thể gian lận/không nhất quán.
- **Consequences:** Business logic quan trọng nằm trong SQL (khó unit-test hơn TS,
  nhưng có pgTAP + integration); thay đổi logic cần migration mới.
- **Current validity:** **Active** — đã tiến hóa qua 6 migration
  (20260806110000 → 20260813010000): thêm origin, strict pool, advisory lock, fail-closed guard.

---

## 4. FSRS-6 shadow scheduling với projection rebuildable

- **Context:** Cần spaced repetition nhưng không muốn trạng thái lịch học mất đi/bị
  sai lệch; tránh lock vào một library.
- **Decision made:** `card_review_events` là event log bất biến; `card_learning_schedule`
  là projection rebuildable (FSRS-6, ts-fsrs 5.4.1, frozen config `flashlearn-v1`);
  mọi write projection qua RPC CAS service-role.
- **Why:** Sự kiện = sự thật; projection có thể rebuild nếu hỏng; CAS chống ghi stale;
  frozen config đảm bảo rebuild đồng nhất.
- **Consequences:** Phức tạp (reconcile orchestrator, repository pattern, CAS); scripts
  maintenance riêng; đổi tham số FSRS phải đổi parameter_set.
- **Current validity:** **Active.** Lưu ý config comment: FSRS hiện "pure infrastructure —
  does NOT yet influence Smart Review eligibility, Dashboard counts, or Mastery UI",
  nhưng thực tế Smart Review đọc due từ `card_learning_schedule` (due-repository) —
  có mâu thuẫn nhẹ giữa comment config và code (xem [15_TECH_DEBT_AND_RISKS](./15_TECH_DEBT_AND_RISKS.md)).

---

## 5. Strict learning-mode filters (không backfill)

- **Context:** Mode "Chưa làm"/"Câu sai" từng bổ sung thẻ khác khi thiếu → gây hiểu nhầm.
- **Decision made:** Filter strict — pool chỉ chứa thẻ đúng tiêu chí; không bao giờ
  backfill; UI hiển thị số khả dụng thật và chặn start nếu thiếu (migration 20260813000000).
- **Why:** Tránh "chọn 20 câu nhưng có 5 câu không phải câu chưa làm".
- **Consequences:** Người dùng có thể không đủ số câu; UI phải hiển thị rõ.
- **Current validity:** **Active.**

---

## 6. Quiz origin (`manual` vs `smart_review`) — coverage chỉ cho manual

- **Context:** Smart Review tạo quiz từ danh sách thẻ do server chọn; cần phân biệt
  với quiz người dùng tự chọn nguồn.
- **Decision made:** Column `origin` immutable (trigger + setting transaction-local
  `flashlearn.quiz_session_origin`); chỉ RPC service-role wrapper được set `smart_review`;
  coverage mode `quiz` chỉ áp dụng origin `manual`.
- **Why:** Không để luồng ôn tự động "đốt" coverage cycle của người dùng.
- **Consequences:** Server action phải kiểm tra origin trước khi coverage completion.
- **Current validity:** **Active.**

---

## 7. Learning coverage dùng session snapshot server-created

- **Context:** Coverage ghi trực tiếp từ client rủi ro không nhất quán/trùng.
- **Decision made:** `learning_coverage_sessions` (server-created snapshot của
  session/scope card ids) + RPC `create_learning_coverage_session` (service role) +
  `complete_learning_coverage_session` (authenticated, advisory lock, idempotent,
  có thể reset khi scope cover hết).
- **Why:** Completion idempotent; reset serialize; client không tự khai "đã làm".
- **Consequences:** Match/Memory tạo session qua admin client; quiz qua RPC trong cùng
  transaction.
- **Current validity:** **Active.**

---

## 8. New Cards là read model tính trong SQL

- **Context:** "Thẻ mới" phải đồng nghĩa "chưa từng học" — tránh materialize toàn bộ
  graph trong app memory.
- **Decision made:** RPC `load_new_card_candidates` anti-join schedule + events
  (fsrs_rating 1–4 hoặc is_correct non-null) → chỉ thẻ genuine new; index hỗ trợ.
- **Why:** Đúng semantics; scale được; dashboard + session creation dùng chung.
- **Current validity:** **Active.**

---

## 9. Import atomic, không lưu file gốc

- **Context:** Import file cần đảm bảo "tất cả hoặc không gì".
- **Decision made:** RPC `import_flashcard_set(name, cards jsonb)` atomic; không persist
  file gốc; validate + normalize server-side.
- **Why:** Tránh partial import; không giữ dữ liệu nhạy cảm/file lớn.
- **Current validity:** **Active.**

---

## 10. Security: client không ghi bảng nhạy cảm

- **Context:** Events/projection/coverage/quiz nếu client ghi trực tiếp sẽ phá invariant.
- **Decision made:** Revoke write grants; chỉ RPC security definer / service role.
- **Why:** Fail closed; invariant ở DB.
- **Current validity:** **Active** — pattern xuyên suốt (xem 05_DATABASE §4).

---

## 11. Constraints (ràng buộc không đổi)

- Quiz `requested == actual`; strict pool; min 10 câu.
- FSRS `flashlearn-v1` frozen.
- Streak local date theo timezone; đổi timezone không đổi activity history (giới hạn 72h).
- Tên collection unique CI per user.
- Snapshot quiz bất biến; `source_flashcard_id` durable.
- Coverage chỉ khi hoàn tất; reset khi cover hết.
- Không backfill filter.
- Origin immutable.
