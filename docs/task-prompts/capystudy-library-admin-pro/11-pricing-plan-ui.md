# LP-11 — Pricing page, plan center và quota messaging

## 0. Metadata

- `Status`: planned
- `Difficulty`: 6/10 — trung bình
- `Risk`: medium; misleading commercial copy, inconsistent limits, upgrade UX
- `Dependencies`: LP-02, LP-07, LP-08
- `Suggested commit`: `feat: add free and pro plan experience`

## 1. Mục tiêu

Hiển thị minh bạch Free/Pro, usage và reset dates; không dùng “unlimited”, không khóa UI giả thay vì
backend và không mở checkout khi billing chưa sẵn sàng.

## 2. Giá đã chốt

- Free: 0đ.
- Pro tháng: 39.000đ/tháng.
- Pro năm: 390.000đ/năm.
- Copy năm: “Tiết kiệm 2 tháng” hoặc tương đương, không tuyên bố phần trăm sai do rounding.
- Monthly/yearly cùng entitlement; monthly quota reset cho cả annual.

## 3. `/pricing`

- Public route hoặc route phù hợp architecture marketing hiện tại.
- Toggle Tháng/Năm có accessible name và URL/default rõ.
- Hai card Free/Pro; Pro nhấn bằng design token nhẹ.
- Bảng quyền lợi lấy từ typed presentation config được test khớp entitlement keys; không query secret/internal safeguards.
- Hiển thị per-source limits chính.
- FAQ:
  - deterministic không tốn AI credit;
  - Pro không vô hạn;
  - quota reset;
  - downgrade không mất data;
  - annual cancellation/effective end ở mức product copy đã duyệt.
- Khi `billing_enabled=false`, CTA là “Xem quyền lợi”/“Sắp ra mắt” hoặc wait state đã duyệt, không checkout giả.

## 4. Plan center trong profile

- Tab/section “Gói sử dụng”.
- Plan/status/current period/grace/next reset.
- Progress cho sets/cards/heavy jobs/AI credits/typing reviews.
- Distinguish monthly quota, per-request cap, rate-limit và concurrency trong copy.
- Usage fetch server-side; loading/error/retry.
- Không hiển thị provider customer/subscription ID.

## 5. Contextual messaging

- 70%: nhắc nhẹ trong plan center.
- 90%: warning inline tại import/feature liên quan.
- 100%: error panel có current/limit/reset và action giảm usage/nâng cấp.
- Preflight AI hiển thị estimated credit trước confirm.
- Hết typing AI review giữa phiên: vẫn nộp và local-grade, báo sau kết quả.
- Không toast cho nội dung cần đọc kỹ; không mất form/draft.
- Không đặt quảng cáo upgrade giữa phiên học cơ bản.

## 6. Nội bộ không hiển thị

- Provider token price/call count.
- Redis keys, risk score, lock TTL.
- Global spend caps và security hard ceiling.
- Raw reservation/job IDs trừ support-friendly reference đã sanitize.

## 7. Tests bắt buộc

- Giá 39.000/390.000 và annual copy.
- Free/Pro table khớp Program Spec.
- Monthly/annual toggle keyboard/mobile.
- Usage percentage/reset/grace/overage.
- Billing disabled/enabled CTA.
- Quota inline error giữ input.
- Không render “unlimited” cho tài nguyên hệ thống.
- Snapshot lớn không dùng; test behavior/accessibility.

## 8. Verification và rollout

- Component/E2E pricing + profile usage.
- `npm run check`, full navigation E2E, `git diff --check`.
- Legal/commercial copy review trước public.
- Page có thể public trước billing nhưng CTA không thu tiền.
