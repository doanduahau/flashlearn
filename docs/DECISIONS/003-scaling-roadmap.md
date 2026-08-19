# ADR 003 — Kênh phân phối (PWA) và lộ trình scale hạ tầng

- **Status:** Accepted
- **Date:** 2026-08-17

## Context

Nhóm đặt câu hỏi chiến lược: PWA khác app tải từ App Store / CH Play như thế nào, người
dùng "tải" app ra sao, và nếu dự án đạt hàng trăm nghìn người dùng thì có phải đổi môi
trường deploy không (có nghe nhắc tới VPS nhưng chưa rõ). Mục đích ADR này là chốt
hướng đi dài hạn để mọi agent/task sau không phải hỏi lại.

## Decision

### 1. Kênh phân phối sản phẩm: PWA (không phải app native)

- Sản phẩm được phân phối dưới dạng **PWA cài được** (manifest + service worker + offline
  - web push — Phase W1–W4). Người dùng cài qua trình duyệt ("Cài đặt ứng dụng" trên
    Android Chrome / "Thêm vào Màn hình chính" trên iOS Safari), không qua chợ app.
- Lý do: phạm vi sản phẩm (học flashcard) không cần API phần cứng; PWA tránh phí + thời
  gian review chợ app; cập nhật deploy tức thì.
- **Escape hatch:** nếu sau này cần lên chợ app thật, bọc Next.js bằng **Capacitor**
  (không viết lại code). KHÔNG xây native riêng trong MVP.
- Lưu ý nền tảng: iOS chỉ nhận push khi **cài PWA + iOS 16.4+** — UI phải hướng dẫn rõ
  (đã ghi trong Task W4).

### 2. Kiến trúc deploy: giữ Vercel + Supabase managed, KHÔNG dùng VPS

- Web: **Vercel** (serverless — tự scale ngang, CDN cache sẵn).
- Data/Auth: **Supabase** (Postgres + Auth + RLS).
- **VPS không cần thiết** ở mọi mốc dự kiến: VPS = tự quản máy ảo (cài đặt, bảo mật,
  backup, scale đều tự lo) — chỉ nên cân nhắc khi chi phí managed vượt xa lợi ích.
- Kiến trúc hiện tại (Next.js + Supabase) **chạy được trên VPS nếu sau này đổi** — code
  không đổi, chỉ đổi nơi chạy. Không có ràng buộc khóa cứng vendor trong code.

### 3. Lộ trình scale khi user tăng

| Giai đoạn           | Ngưỡng                             | Việc cần làm                                                                                                                                                                                             |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Beta (hiện tại)** | vài chục user                      | Vercel Hobby + Supabase Free (ADR 002)                                                                                                                                                                   |
| **Tăng trưởng**     | ~50k MAU (giới hạn Auth free tier) | Lên **Supabase Pro/Team** + **Sentry** (giám sát lỗi) + **cache Redis (Upstash)** cho query nóng (dashboard/streak/statistics) + connection pooling (pgBouncer) + **giới hạn rate Gemini** (AI chấm bài) |
| **Quy mô lớn**      | 100k+ users                        | Nâng instance DB / read replicas nếu cần · gửi push theo **batch** · tối ưu query theo dữ liệu thật · cân nhắc VPS/self-host CHỈ nếu chi phí managed cao                                                 |

### 4. Rủi ro vận hành chính khi scale

1. **Database là nút thắt chính** — không phải web (Vercel tự scale). Đã có index; thêm
   cache Redis + pooling là đủ cho phần lớn trường hợp.
2. **Chi phí + độ trễ AI chấm điểm (Gemini)** — rủi ro lớn nhất khi scale (tính theo
   câu × user). Cần rate limit + cache kết quả + theo dõi chi phí.
3. **Push fan-out** — gửi hàng chục nghìn subscription phải chia batch + xử lý lỗi
   (thiết kế Task W3 đã theo hướng này).
4. **Free tier Supabase giới hạn 50k MAU** — phải lên trả phí trước mốc này.

## Consequences

- Mọi task PWA/offline/push (W1–W4) theo đúng hướng PWA — không thiết kế theo kiểu
  "để dành cho native".
- Khi gặp vấn đề hiệu năng ở quy mô lớn, thứ tự ưu tiên xử lý: ① cache Redis ② lên tier
  Supabase + pooling ③ tối ưu query theo dữ liệu thật ④ Sentry giám sát ⑤ mới cân nhắc VPS.
- Không đầu tư VPS/self-host trước khi có hàng chục nghìn user thật — quyết định dựa
  trên dữ liệu thật lúc đó.

## References

- `docs/DECISIONS/002-free-tier-beta-deployment.md` — kiến trúc deploy giai đoạn beta.
- `docs/DEPLOYMENT.md` — hướng dẫn deploy hiện tại.
- `docs/task-prompts/capystudy-task-w{1-4}-*.md` — Phase Mobile PWA (offline + notifications).
