# LP Program Spec — Product, quota và kiến trúc dùng chung

## 0. Trạng thái và phạm vi

- `Status`: approved for implementation planning
- `Product`: CapyStudy
- `Owner email`: `phamvandoan707@gmail.com`
- `Billing provider`: chưa chọn
- `Production payment`: chưa được bật

File này là contract chung cho LP-01 đến LP-14. Task con không được tự thay đổi con số hoặc
business rule trong file này. Nếu cần thay đổi, phải ghi open question và xin xác nhận.

## 1. Các invariant sản phẩm

### 1.1 Starter và catalog

- Có đúng ba starter template mặc định:
  1. Trái cây: khoảng 50 thẻ, Tiếng Việt → Tiếng Anh.
  2. Động vật: khoảng 50 thẻ, Tiếng Việt → Tiếng Anh.
  3. Khoa học và xã hội: khoảng 50 thẻ hỏi–đáp tiếng Việt.
- Mỗi template được lưu một lần trong catalog.
- Khi cài, hệ thống clone snapshot thành `flashcard_sets`/`flashcards` thuộc user.
- Bản clone hoạt động như bộ thường và tương thích mọi chế độ hiện có.
- User được sửa, đổi tên, chia sẻ, thêm vào bộ đặc biệt và xóa bản clone.
- Catalog update không ghi đè bản clone.
- Một user chỉ có tối đa một bản active từ một catalog template tại một thời điểm.
- Sau khi xóa bản active, user được cài lại.
- Cài/clone là atomic, idempotent và concurrency-safe.
- Starter provisioning không được làm chậm hoặc phá Auth trigger.

### 1.2 Free/Pro

- Free phải dùng được toàn bộ các chế độ học cơ bản.
- Pro tăng dung lượng, import lớn, tài liệu/AI, chia sẻ/lớp và thống kê; không có “unlimited”.
- Pro tháng và năm dùng cùng entitlement.
- Gói năm có quota reset theo các kỳ tháng, không cấp 12 tháng quota cùng lúc.
- Backend là nguồn quyết định entitlement; client chỉ hiển thị.
- Không xóa hoặc ẩn dữ liệu khi downgrade.

### 1.3 Deterministic-first

- CSV/XLSX/Google Sheets/Paste dạng bảng dùng parser thì không trừ AI credit.
- DOCX/PDF có section xử lý chắc chắn bằng code thì section đó không trừ AI credit.
- Chỉ phần dữ liệu thật sự gửi provider mới được tính AI usage.
- AI failure không được biến một kết quả local đúng thành sai hoặc làm mất dữ liệu draft.

## 2. Entitlement v1

| Key                                |  Free |                      Pro |
| ---------------------------------- | ----: | -----------------------: |
| `sets.regular.max`                 |    20 |                      200 |
| `cards.total.max`                  | 3.000 |                   30.000 |
| `collections.max`                  |    10 |                      100 |
| `card.side_chars.soft_max`         | 5.000 |                   20.000 |
| `share.active_links.max`           |     3 |                       50 |
| `classroom.active.max`             |     1 |                       20 |
| `classroom.members_per_class.max`  |    30 |                      300 |
| `statistics.detailed_days`         |    30 | Không giới hạn theo plan |
| `ai.content_credits.monthly`       |    20 |                      300 |
| `ai.typing_reviews.monthly`        |   100 |                    2.000 |
| `documents.heavy_jobs.monthly`     |    10 |                      100 |
| `documents.heavy_jobs.rolling_day` |     2 |                       10 |
| `jobs.heavy.concurrent`            |     1 |                        2 |

Database hard ceiling `CARD_TEXT_MAX_LENGTH = 50.000` vẫn là lớp an toàn cuối. Soft limit theo plan
được kiểm tra trước mutation; dữ liệu legacy không bị cắt.

## 3. Giới hạn theo nguồn

| Nguồn                       | Free                                  | Pro                                      | Monthly quota                   |
| --------------------------- | ------------------------------------- | ---------------------------------------- | ------------------------------- |
| Thủ công                    | 500 thẻ/bộ                            | 2.000 thẻ/bộ                             | Không                           |
| CSV/XLSX                    | 5 MB, 500 thẻ/lần                     | 15 MB, 2.000 thẻ/lần                     | Không                           |
| Google Sheets deterministic | 500 hàng/lần                          | 2.000 hàng/lần                           | Không                           |
| Paste structured            | 50.000 ký tự, 500 thẻ                 | 200.000 ký tự, 2.000 thẻ                 | Không                           |
| Paste prose                 | 25.000 ký tự, 100 thẻ                 | 100.000 ký tự, 500 thẻ                   | AI credit                       |
| DOCX                        | 5 MB, 30.000 ký tự, 100 thẻ           | 15 MB, 100.000 ký tự, 500 thẻ            | Heavy job; AI credit khi gọi AI |
| PDF                         | 5 MB, 30 trang, 30.000 ký tự, 100 thẻ | 15 MB, 200 trang, 100.000 ký tự, 500 thẻ | Heavy job; AI credit khi gọi AI |
| OCR/scan                    | Không hỗ trợ                          | Không hỗ trợ                             | Không áp dụng                   |
| Lưu file gốc                | Không                                 | Không                                    | Không áp dụng                   |

## 4. AI credit v1

Phép tính quota dễ dự đoán, độc lập với thay đổi giá model:

```text
content_credit = max(
  1,
  ceil(ai_input_characters / 5.000)
  + ceil(ai_generated_cards / 25)
)
```

- Preflight dùng ước tính và reserve mức tối đa hợp lý.
- Finalize dùng số liệu thực tế đã được chấp nhận.
- Backend đồng thời lưu provider input/output tokens để đo chi phí, không dùng token làm UI contract v1.
- Classification AI được tính theo ký tự thực sự gửi.
- Typing dùng ledger riêng theo số câu local đánh sai được gửi AI.
- Retry vật lý phải nằm trong reservation; không double-charge user.
- Invalid input trước provider: không charge.
- Provider/platform failure không có kết quả dùng được: refund reservation.
- User đóng tab sau khi provider đã hoàn thành không tự động refund.

## 5. Rate-limit và concurrency v1

| Action                        |                     Free |                      Pro |
| ----------------------------- | -----------------------: | -----------------------: |
| Commit import                 |                   12/giờ |                   30/giờ |
| Start AI/heavy job            |                    4/giờ |                   20/giờ |
| Catalog install               |                   10/giờ |                   30/giờ |
| Learning submit               |               30/10 phút |               60/10 phút |
| Heavy jobs concurrent         |                        1 |                        2 |
| Physical AI calls/logical job |                        5 |                       20 |
| Public share read             | 120/phút theo IP + token | 120/phút theo IP + token |

Rate-limit là lớp chống burst, không thay quota. Quota là quyền sử dụng theo kỳ; concurrency là số
job đang chạy; file/page/card limit là giới hạn mỗi request. Không được trộn các khái niệm này.

## 6. Subscription lifecycle v1

- `free`: không subscription hoặc subscription Free mặc định.
- `trialing`: chỉ tồn tại nếu sau này có quyết định riêng; không tự thêm trial trong task hiện tại.
- `active`: Pro đang có hiệu lực.
- `past_due`: chờ chính sách provider; không khóa dữ liệu.
- `cancel_at_period_end`: vẫn Pro đến `current_period_end`.
- `grace`: 14 ngày sau khi mất hiệu lực Pro.
- `expired`: resolve về Free sau grace.

Sau downgrade/expiry:

- Vẫn xem, học, quiz, sửa không tăng usage, đổi tên, export và xóa.
- Không import/tạo thêm nếu làm tăng phần vượt Free.
- Link/lớp hiện có không tự bị xóa; chặn tạo mới và chặn tăng membership vượt giới hạn.
- Không tự xóa data theo thời gian.
- Tài khoản legacy vượt cap tại rollout có `legacy_storage_floor` hoặc override tương đương.

## 7. Kiến trúc dữ liệu mục tiêu

Tên chính xác được chốt ở migration design review, nhưng trách nhiệm phải giữ nguyên:

- Catalog: `catalog_categories`, `catalog_sets`, `catalog_cards`, `user_catalog_installs`.
- Plan: `plans`, `plan_entitlements`, `user_subscriptions`, `entitlement_overrides`.
- Usage: `usage_periods`, `usage_ledger`, `quota_reservations`, `processing_jobs`.
- Billing: `billing_events` và provider identifiers chỉ ở billing module.
- Admin: `user_roles`, `admin_audit_logs`.

Không dùng một JSON blob duy nhất trong `profiles` cho tất cả plan/quota/admin state. Không phụ thuộc
vào `NEXT_PUBLIC_*` để quyết định entitlement.

## 8. API/domain contracts mục tiêu

```ts
getEffectivePlan(userId);
getEntitlement(userId, entitlementKey);
getUsageSnapshot(userId, usageKey, period);
reserveUsage(userId, usageKey, requestedAmount, idempotencyKey);
finalizeUsage(reservationId, actualAmount);
refundUsage(reservationId, reason);
assertCanGrowStorage(userId, delta);
provisionStarterSets(userId);
installCatalogSet(userId, catalogSetId, idempotencyKey);
```

Các function này là domain/service boundary. UI và import adapters không tự đọc bảng plan để suy ra
quyền lợi, tránh business rule bị lặp.

## 9. Feature flags và rollout modes

- `catalog_enabled`: ẩn/hiện catalog UI.
- `starter_provisioning_enabled`: bật provision user mới.
- `quota_enforcement_mode`: `observe`, `warn`, `block`.
- `admin_console_enabled`: chỉ có tác dụng sau server RBAC.
- `billing_enabled`: mặc định false đến khi LP-13 và LP-14 hoàn tất.

Flag phải có owner, mục đích, default an toàn và kế hoạch xóa. Flag UI không thay thế authorization.

## 10. Privacy và telemetry

Được log/đo:

- User ID dạng UUID khi cần điều tra server-side, hoặc hash/pseudonym cho analytics.
- Source type, bytes, rows, pages, character count.
- Parse time, status, error code, AI calls/tokens/cards, quota decision.
- Job/reservation/request correlation ID.

Không log:

- Nội dung thẻ/tài liệu.
- Email trong analytics/log thường.
- Access token, API key, subscription secret, webhook body chưa lọc.
- Dữ liệu thanh toán nhạy cảm.

## 11. Definition of Done toàn chương trình

- Starter/catalog hoạt động với mọi learning mode hiện có.
- Không có clone trùng do retry/concurrency.
- Quota deterministic và AI được phân biệt đúng.
- Không có đường mutation quan trọng bypass entitlement.
- Admin role được enforce ở server/RLS và có audit.
- Downgrade không mất hoặc khóa dữ liệu cũ bất ngờ.
- Billing event idempotent và reconcile được sau khi chọn provider.
- Staging pass, backup/restore verified, production access owner/CI-CD only.
- `npm run check`, DB tests và E2E release suite pass.
- Tài liệu architecture/database/import/deployment/operations được cập nhật theo code thật.
