# Checklist thao tác thủ công cho production

Mục tiêu: đưa CapyStudy lên production an toàn theo thứ tự **staging trước,
production sau**. Không chép secret, token hoặc DSN vào Git, chat hay ảnh chụp
màn hình.

## Trạng thái code đã sẵn sàng

- Rate limit và circuit breaker đã dùng managed Redis khi cấu hình Upstash có mặt.
- Sentry, readiness endpoint, validation environment và runbook đã có trong repo.
- Production sẽ fail closed cho các hành động bị rate-limit nếu không có Redis.
- `npm run check`, E2E và format đã được xác minh trong đợt release gần nhất.

## 1. Tạo và xác minh staging trên Vercel (miễn phí)

1. Giữ `main` là Production Branch của project Vercel `flashlearn`.
2. Tạo branch `staging` từ `main` trên GitHub.
3. Push ít nhất một commit hợp lệ lên `staging` để Vercel tạo Preview Deployment.
   Chỉ tạo branch không luôn kích hoạt build.
4. Lưu Preview URL; đây là URL staging dùng ở các bước sau.
5. Không đổi domain production hoặc deploy `main` trong bước này.

## 2. Tạo Upstash Redis free tier

1. Đăng nhập Upstash, tạo database Redis bằng gói free trong region gần Vercel/Supabase.
2. Không bật add-on hoặc gói trả phí.
3. Lấy REST URL và REST token, giữ bí mật.
4. Trên Vercel → Environment Variables, đặt cho **Preview/staging**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `CAPYSTUDY_ENVIRONMENT=staging`
5. Redeploy staging. Mở `{STAGING_URL}/api/health/ready` theo cơ chế token của
   ứng dụng để xác nhận Redis sẵn sàng.

## 3. Tạo Sentry free tier

1. Đăng nhập Sentry, tạo organization/project Next.js theo gói free.
2. Gắn environment `staging` và tạo alert miễn phí nếu giao diện gói free hỗ trợ.
3. Lấy DSN server và DSN public; không gửi chúng vào chat.
4. Trên Vercel Preview/staging, thêm:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
5. Redeploy staging, tạo một lỗi thử nghiệm có kiểm soát nếu runbook hiện hành cho phép,
   rồi xác nhận event có environment `staging`.

## 4. Hoàn thiện các biến staging

Trong Vercel, sao chép các biến **không phải secret** và secret từ nguồn quản lý
an toàn vào môi trường Preview/staging:

- `NEXT_PUBLIC_APP_URL={STAGING_URL}`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (nếu bật import AI)
- `HEALTHCHECK_TOKEN` (tạo chuỗi ngẫu nhiên, chỉ lưu tại Vercel/secret manager)
- cấu hình Google Sheets nếu feature này được bật.

Tuyệt đối không đặt bất kỳ `CAPYSTUDY_*_MOCK=1` nào ở staging hoặc production.

## 5. Cấu hình Supabase Auth cho staging

1. Supabase Dashboard → Authentication → URL Configuration.
2. Thêm Site URL/Redirect URL staging:
   - `{STAGING_URL}`
   - `{STAGING_URL}/auth/confirm`
3. Không xoá URL production hiện có.
4. So sánh migration history với `supabase/migrations/`.
   Nếu thấy migration thiếu, thừa hoặc không rõ nguồn gốc: **dừng lại, không db push**.
5. Xác nhận RLS vẫn bật cho các bảng ứng dụng.

## 6. Cấu hình Google Cloud, nếu bật Google Sheets

1. Google Cloud Console → OAuth client web.
2. Thêm staging origin và callback cần thiết.
3. Giới hạn browser API key theo HTTP referrer staging và production.
4. Giới hạn API key chỉ cho Google Sheets API và Google Picker API.
5. Xác nhận Sheets API và Picker API đang bật.

Nếu không có quyền Google Cloud, để feature Google Sheets chưa kiểm chứng và
ghi nhận là blocker trước public launch.

## 7. Staging smoke test

Sau khi staging redeploy thành công:

1. Đăng ký/đăng nhập một tài khoản test riêng.
2. Kiểm tra import CSV nhỏ, study, quiz tối thiểu 10 thẻ và kết quả/streak.
3. Kiểm tra link share public có rate-limit nhưng người dùng bình thường không gặp CAPTCHA.
4. Kiểm tra `/api/health/ready` bằng token hợp lệ.
5. Kiểm tra Sentry nhận lỗi test/staging theo runbook.
6. Kiểm tra responsive cơ bản ở viewport 390×844.
7. Nếu bất cứ bước nào fail: sửa staging, không deploy production.

## 8. Chuyển sang production (chỉ sau staging pass)

1. Xác nhận owner phê duyệt release và commit deploy.
2. Trong Vercel Production, đặt các biến tương ứng:
   - `CAPYSTUDY_ENVIRONMENT=production`
   - Upstash URL/token
   - Sentry DSN/public DSN
   - `HEALTHCHECK_TOKEN`
   - `NEXT_PUBLIC_APP_URL={PRODUCTION_URL}`
   - Supabase, Gemini và Google variables cần thiết.
3. Đảm bảo production chỉ owner/CI-CD có quyền deploy trong giới hạn gói hiện tại.
   Nếu Vercel/GitHub free tier không đáp ứng, xem `PRODUCTION_DEFERRED_COSTS.md`.
4. Cập nhật Supabase Auth URL Configuration bằng production URL và
   `{PRODUCTION_URL}/auth/confirm`.
5. Redeploy `main`, chạy smoke test production với tài khoản test riêng.
6. Xóa dữ liệu/tài khoản smoke test sau khi hoàn tất.

## 9. Backup, restore và domain

- Không mua gói backup, custom domain, email service hoặc quyền team nếu chưa được
  owner phê duyệt.
- Đối chiếu khả năng backup của gói Supabase hiện tại với RPO <= 24h và RTO <= 4h.
- Nếu không đáp ứng, ghi quyết định và phương án vào `PRODUCTION_DEFERRED_COSTS.md`.
- Chỉ thực hiện restore drill trên Supabase project cô lập, không restore vào production.
- Chỉ thêm custom domain CapyStudy, OAuth callback production và email branding khi
  domain/email service đã được owner duyệt.

## 10. Ghi nhận kết quả

Sau mỗi lần triển khai, cập nhật deployment record trong `docs/DEPLOYMENT.md` hoặc
tạo record ngày triển khai, gồm commit, URL staging/production, migration status,
smoke results và rollback decision. Không ghi secret vào record.
