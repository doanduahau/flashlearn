# AGENTS.md — FlashLearn Project Blueprint

> Đây là nguồn sự thật chính dành cho mọi AI coding agent làm việc trong dự án.  
> Agent phải đọc toàn bộ file này trước khi phân tích, sửa code, tạo migration hoặc cài dependency.

---

## 1. Tổng quan sản phẩm

**Tên làm việc:** FlashLearn

FlashLearn là nền tảng giúp người dùng biến bất kỳ file Excel có hai cột thành một hệ thống học bằng flashcard và bài kiểm tra.

Mỗi dòng dữ liệu tạo thành một flashcard:

- Một cột được chọn làm **mặt trước**.
- Một cột được chọn làm **mặt sau**.

Sản phẩm không giới hạn ở học từ vựng. Người dùng có thể học:

- Ngoại ngữ.
- Kiến thức phổ thông.
- Lập trình.
- Công thức.
- Luật.
- Y khoa.
- Câu hỏi phỏng vấn.
- Bất kỳ nội dung hỏi – đáp nào biểu diễn được bằng hai cột.

### Định vị ngắn gọn

> Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh.

---

## 2. Mục tiêu MVP

MVP phải hỗ trợ luồng hoàn chỉnh:

1. Người dùng đăng nhập.
2. Tải file Excel hoặc CSV.
3. Chọn cột cho mặt trước và mặt sau.
4. Nhập tên bộ flashcard.
5. Xem trước, kiểm tra và xác nhận dữ liệu.
6. Học bằng flashcard.
7. Thêm flashcard vào các bộ đặc biệt.
8. Tạo bài kiểm tra từ một hoặc nhiều bộ đã chọn.
9. Hoàn thành bài kiểm tra và xem kết quả.
10. Duy trì chuỗi học tập hằng ngày.

MVP ưu tiên tính ổn định, rõ ràng và dễ mở rộng hơn số lượng tính năng.

---

## 3. Phạm vi chức năng

### 3.1. Bộ flashcard thông thường

- Mỗi lần import file sẽ tạo một bộ flashcard thông thường.
- Người dùng phải nhập tên bộ trước khi xác nhận import.
- Flashcard gốc thuộc đúng một bộ thông thường.
- Người dùng có thể:
  - Đổi tên bộ.
  - Xem danh sách thẻ.
  - Thêm thẻ thủ công.
  - Sửa mặt trước hoặc mặt sau.
  - Xóa thẻ.
  - Xóa bộ.

Ví dụ:

- React Fundamentals.
- Lịch sử chương 2.
- TOEIC Unit 1.
- Câu hỏi phỏng vấn Backend.

### 3.2. Bộ đặc biệt

Bộ đặc biệt do người dùng tự tạo để gom thẻ từ nhiều bộ thông thường.

Ví dụ:

- Khó nhớ.
- Quan trọng.
- Thú vị.
- Cần ôn lại.
- Yêu thích.

Quy tắc:

- Một flashcard có thể thuộc nhiều bộ đặc biệt.
- Không sao chép nội dung flashcard.
- Bộ đặc biệt chỉ lưu liên kết đến flashcard gốc.
- Khi flashcard gốc được sửa, thay đổi phải xuất hiện ở mọi bộ đặc biệt.

### 3.3. Học flashcard

Chế độ học cần hỗ trợ:

- Hiển thị mặt trước.
- Lật để xem mặt sau.
- Thẻ trước và thẻ tiếp theo.
- Trộn thứ tự.
- Theo dõi tiến độ trong phiên học.
- Thêm hoặc bỏ thẻ khỏi bộ đặc biệt.
- Chỉnh sửa thẻ khi có quyền.
- Hỗ trợ bàn phím trên desktop.
- Giao diện cảm ứng tốt trên mobile.

### 3.4. Bài kiểm tra

Người dùng có thể chọn nguồn câu hỏi từ:

- Một hoặc nhiều bộ thông thường.
- Một hoặc nhiều bộ đặc biệt.
- Kết hợp cả hai loại.
- Tất cả bộ đang có.

Sau khi chọn nguồn, hệ thống phải:

1. Gộp các flashcard.
2. Loại bỏ flashcard trùng theo `flashcard_id`.
3. Hiển thị tổng số thẻ hợp lệ.
4. Cho người dùng chọn số câu.
5. Chỉ cho bắt đầu khi có ít nhất 10 flashcard hợp lệ.

Quy tắc số câu:

- Tối thiểu: `10`.
- Tối đa: tổng số flashcard không trùng trong phạm vi đã chọn.
- Có lựa chọn nhanh như `10`, `20`, `30`, `50`.
- Có ô nhập số tùy chỉnh.
- Không âm thầm giảm số câu người dùng đã chọn.

Mỗi câu trắc nghiệm gồm:

- Một mặt trước làm câu hỏi.
- Một mặt sau đúng.
- Ba đáp án nhiễu lấy từ các flashcard khác.
- Các đáp án không được trùng nhau sau khi chuẩn hóa.
- Thứ tự đáp án phải được trộn.

### 3.5. Chế độ tạo đề

MVP hỗ trợ bốn chế độ:

#### Balanced — mặc định

Ưu tiên:

1. Thẻ chưa từng được kiểm tra.
2. Thẻ không xuất hiện trong bài test gần nhất.
3. Thẻ có số lần xuất hiện thấp.
4. Thẻ lâu chưa được kiểm tra.
5. Thẻ có tỷ lệ trả lời sai cao hơn.

#### Never Tested

- Chỉ ưu tiên thẻ chưa từng được kiểm tra.
- Nếu không đủ số câu, bổ sung bằng các thẻ ít được kiểm tra nhất.
- UI phải thông báo rõ khi phải bổ sung thẻ đã từng xuất hiện.

#### Wrong Answers

- Ưu tiên thẻ từng trả lời sai.
- Ưu tiên sai gần đây hoặc sai nhiều lần.
- Nếu không đủ số câu, bổ sung theo chiến lược Balanced.

#### Pure Random

- Chọn ngẫu nhiên từ toàn bộ phạm vi.
- Vẫn không được trùng câu trong cùng một bài test.

### 3.6. Hạn chế câu hỏi lặp lại

Hệ thống phải lưu lịch sử theo từng flashcard và người dùng:

- Tổng số lần được kiểm tra.
- Tổng số lần đúng.
- Tổng số lần sai.
- Thời điểm kiểm tra gần nhất.
- Kết quả gần nhất.
- Bài test gần nhất mà thẻ xuất hiện.

Mục tiêu:

- Không để cùng một thẻ xuất hiện trong hai bài test liên tiếp nếu còn đủ thẻ khác.
- Phân phối số lần xuất hiện tương đối đồng đều.
- Chỉ lặp lại khi không còn đủ thẻ mới hoặc thẻ ít xuất hiện hơn.

Không dùng `ORDER BY random()` làm chiến lược chính cho Balanced.

### 3.7. Streak

- Hoàn thành ít nhất một bài test hợp lệ trong ngày để duy trì streak.
- Làm nhiều bài trong cùng ngày chỉ ghi nhận một ngày streak.
- Streak được tính theo ngày địa phương của người dùng.
- Timestamp lưu dưới UTC.
- Ngày học phải được suy ra bằng timezone đã lưu trong hồ sơ người dùng.
- Nếu người dùng chưa chọn timezone, dùng timezone của trình duyệt; fallback là `Asia/Ho_Chi_Minh`.

Theo dõi:

- Streak hiện tại.
- Streak dài nhất.
- Lịch học.
- Tổng số bài test.
- Độ chính xác.
- Các thẻ thường trả lời sai.

---

## 4. Ngoài phạm vi MVP

Không tự ý xây dựng các tính năng dưới đây nếu task không yêu cầu:

- AI tự sinh câu hỏi.
- OCR từ ảnh hoặc PDF.
- Chia sẻ bộ công khai.
- Marketplace.
- Học nhóm hoặc lớp học.
- Chat.
- Thanh toán.
- Achievement phức tạp.
- Spaced repetition nâng cao như SM-2.
- Native mobile app.
- Realtime collaboration.

Kiến trúc nên cho phép mở rộng, nhưng không over-engineer cho tính năng chưa tồn tại.

---

## 5. Công nghệ tiêu chuẩn

### Frontend

- Next.js với App Router.
- React.
- TypeScript strict mode.
- Tailwind CSS.
- shadcn/ui.
- React Hook Form.
- Zod.

### Data và backend

- Supabase Auth.
- Supabase PostgreSQL.
- Supabase Row Level Security.
- Supabase Storage chỉ khi thật sự cần.
- TanStack Query chỉ dùng cho client-side server state có lợi từ cache/refetch.
- Server Components và server-side data fetching được ưu tiên mặc định.

### Import file

- SheetJS cho `.xlsx`.
- Parser phù hợp cho `.csv`.
- Chỉ đọc dữ liệu cần thiết.
- Không thực thi macro hoặc công thức từ file.

### Testing

- Vitest cho unit test.
- React Testing Library cho component test.
- Playwright cho E2E.

### Công cụ dự án

- npm.
- ESLint.
- Prettier.
- Husky.
- lint-staged.

Không khóa cứng phiên bản trong tài liệu này. Khi khởi tạo, dùng phiên bản stable tương thích tại thời điểm triển khai và ghi lại trong `package.json`.

---

## 6. Nguyên tắc kiến trúc

### 6.1. Feature-first

Code nghiệp vụ phải được nhóm theo tính năng, không gom tất cả API, hook hoặc type vào các thư mục toàn cục khổng lồ.

Ví dụ:

```text
src/features/quiz/
├── components/
├── server/
├── schemas/
├── types/
├── utils/
└── index.ts
```

### 6.2. Server-first

- Dùng Server Components mặc định.
- Chỉ thêm `"use client"` khi cần state trình duyệt, event handler, animation hoặc browser API.
- Không biến cả page thành Client Component chỉ vì một component con cần tương tác.
- Data nhạy cảm và mutation phải đi qua server boundary.

### 6.3. Tách UI và nghiệp vụ

- Component UI không trực tiếp chứa truy vấn database.
- Thuật toán tạo đề không được viết trong page component.
- Validation schema không được lặp lại ở nhiều nơi.
- Repository/query layer không chứa logic trình bày.

### 6.4. Ranh giới dữ liệu rõ ràng

Mọi dữ liệu đi vào hệ thống phải được kiểm tra tại boundary:

- Form input.
- URL params.
- Search params.
- File import.
- Server actions.
- Route handlers.
- Dữ liệu trả về từ service ngoài.

Dùng Zod hoặc validation rõ ràng tương đương.

### 6.5. Không abstraction sớm

Chỉ tạo abstraction khi:

- Logic được dùng ở ít nhất hai nơi.
- Abstraction giúp kiểm thử rõ hơn.
- Domain boundary thật sự tồn tại.

Không tạo generic repository hoặc factory phức tạp chỉ để “có kiến trúc”.

---

## 7. Cấu trúc thư mục đề xuất

```text
.
├── AGENTS.md
├── README.md
├── package.json
├── next.config.ts
├── middleware.ts
├── .env.example
├── public/
│   ├── icons/
│   ├── illustrations/
│   └── images/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   └── page.tsx
│   │   ├── (auth)/
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── import/
│   │   │   ├── sets/
│   │   │   ├── collections/
│   │   │   ├── study/
│   │   │   ├── quiz/
│   │   │   ├── history/
│   │   │   ├── statistics/
│   │   │   └── settings/
│   │   ├── api/
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── loading.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── shared/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── imports/
│   │   ├── flashcard-sets/
│   │   ├── flashcards/
│   │   ├── special-collections/
│   │   ├── study/
│   │   ├── quiz/
│   │   ├── streak/
│   │   └── analytics/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── middleware.ts
│   │   │   └── types.ts
│   │   ├── excel/
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── styles/
│   └── types/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── components/
│   ├── e2e/
│   └── fixtures/
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── ROUTES.md
    ├── DESIGN.md
    └── DECISIONS/
```

### Quy tắc đặt code trong feature

Một feature chỉ tạo các thư mục cần thiết:

```text
src/features/imports/
├── components/
│   ├── import-dropzone.tsx
│   ├── column-mapper.tsx
│   └── import-preview-table.tsx
├── server/
│   ├── actions.ts
│   └── import-flashcards.ts
├── schemas/
│   └── import-schema.ts
├── types/
│   └── import-types.ts
├── utils/
│   ├── parse-workbook.ts
│   └── normalize-import-row.ts
└── index.ts
```

Không tạo `index.ts` barrel export nếu nó gây circular dependency hoặc che giấu nguồn import.

---

## 8. Route map

### Public

```text
/                  Landing page
/sign-in           Đăng nhập
/sign-up           Đăng ký
```

### Authenticated

```text
/dashboard         Tổng quan học tập
/import            Import Excel hoặc CSV
/sets              Danh sách bộ thông thường
/sets/[setId]      Chi tiết bộ và danh sách flashcard
/collections       Danh sách bộ đặc biệt
/collections/[id]  Chi tiết bộ đặc biệt
/study             Chọn phạm vi học
/study/[sessionId] Phiên học flashcard
/quiz              Thiết lập bài test
/quiz/[attemptId]  Làm bài test
/quiz/[attemptId]/result
/history           Lịch sử bài test
/statistics        Thống kê và streak
/settings          Hồ sơ và thiết lập
```

Không tạo route động nếu chưa có use case rõ ràng.

---

## 9. Mô hình dữ liệu cấp cao

Tên bảng có thể điều chỉnh trước migration đầu tiên, nhưng quan hệ không được thay đổi tùy tiện.

### `profiles`

- `id` tham chiếu `auth.users.id`.
- Tên hiển thị.
- Avatar.
- Timezone.
- Ngày tạo và cập nhật.

### `flashcard_sets`

- Chủ sở hữu.
- Tên bộ.
- Mô tả tùy chọn.
- Nguồn import tùy chọn.
- Số thứ tự hoặc metadata nhẹ nếu cần.
- Timestamps.

### `flashcards`

- Chủ sở hữu.
- `set_id`.
- `front`.
- `back`.
- Vị trí trong bộ.
- Timestamps.
- Soft delete chỉ dùng khi có yêu cầu phục hồi hoặc audit thật sự.

### `special_collections`

- Chủ sở hữu.
- Tên.
- Icon hoặc emoji tùy chọn.
- Màu semantic tùy chọn.
- Timestamps.

### `special_collection_items`

- `collection_id`.
- `flashcard_id`.
- Timestamps.
- Unique constraint cho cặp trên.

### `quiz_attempts`

- Chủ sở hữu.
- Trạng thái.
- Chế độ.
- Số câu yêu cầu.
- Số câu thực tế.
- Điểm.
- Bắt đầu và hoàn thành lúc nào.
- Snapshot thiết lập nguồn bài test.

### `quiz_attempt_items`

Mỗi câu trong bài test cần snapshot để lịch sử không bị thay đổi khi flashcard gốc được sửa:

- `attempt_id`.
- `flashcard_id`.
- `question_order`.
- Snapshot mặt trước.
- Snapshot đáp án đúng.
- Danh sách đáp án đã trộn.
- Đáp án người dùng chọn.
- Đúng hoặc sai.
- Thời gian trả lời.
- Timestamps.

### `flashcard_learning_stats`

Thống kê theo người dùng và flashcard:

- `user_id`.
- `flashcard_id`.
- `test_count`.
- `correct_count`.
- `wrong_count`.
- `last_tested_at`.
- `last_result`.
- `last_attempt_id`.

### `daily_learning_records`

- `user_id`.
- Ngày địa phương.
- Timezone đã dùng.
- Số bài hoàn thành.
- Số câu đã trả lời.
- Unique constraint theo `user_id + local_date`.

### Quy tắc database

- Mọi bảng thuộc người dùng phải có `user_id` hoặc có đường liên kết sở hữu không mơ hồ.
- Bật RLS trước khi expose feature.
- Không dựa vào filter phía client để bảo mật.
- Tạo index cho foreign key và cột truy vấn thường xuyên.
- Migrations phải có thể chạy từ database sạch.
- Không sửa migration đã được áp dụng; tạo migration mới.
- Mọi destructive migration phải có ghi chú và phương án rollback hoặc migration dữ liệu.

---

## 10. Import Excel và CSV

### Luồng chuẩn

1. Người dùng chọn file.
2. Client kiểm tra extension và dung lượng.
3. Parser đọc workbook.
4. Người dùng chọn sheet nếu file có nhiều sheet.
5. Hiển thị các header tìm thấy.
6. Người dùng chọn cột mặt trước và mặt sau.
7. Người dùng nhập tên bộ.
8. Hệ thống hiển thị preview và lỗi.
9. Người dùng xác nhận.
10. Server validate lại và ghi dữ liệu trong transaction hoặc quy trình đảm bảo tính toàn vẹn.

### Chuẩn hóa dữ liệu

- Chuyển giá trị thành chuỗi an toàn.
- Trim khoảng trắng đầu và cuối.
- Chuẩn hóa newline.
- Không tự ý lowercase nội dung hiển thị.
- Hàng thiếu mặt trước hoặc mặt sau là không hợp lệ.
- Hàng hoàn toàn trống được bỏ qua.
- Trùng chính xác sau khi trim trong cùng file phải được đánh dấu.
- MVP có thể mặc định bỏ bản trùng và báo số lượng, nhưng UI phải thông báo rõ.
- Không tự ý gộp các thẻ có nội dung “gần giống”.

### An toàn

- Giới hạn dung lượng file bằng hằng số cấu hình.
- Giới hạn số hàng import trong một lần.
- Không lưu file gốc nếu không cần.
- Không tin dữ liệu parsed từ client; server phải xác thực lại payload.
- Escape nội dung khi hiển thị.
- Không render HTML trực tiếp từ ô Excel.

---

## 11. Thiết kế giao diện — Soft Green Learning Garden

### 11.1. Tinh thần

Giao diện phải:

- Thân thiện.
- Bo tròn.
- Mát mắt.
- Có cảm giác vừa học vừa chơi.
- Không giống dashboard doanh nghiệp.
- Không quá trẻ con.
- Có chuyển động nhẹ và phản hồi tích cực.

Ẩn dụ thiết kế:

> Người dùng đang chăm sóc một khu vườn kiến thức; mỗi bài học giúp khu vườn phát triển.

### 11.2. Bảng màu nền tảng

```css
--background: #f8fbf7;
--surface: #ffffff;
--surface-subtle: #f1f7f3;

--primary: #7bcfa6;
--primary-hover: #65be91;
--primary-soft: #eaf8f0;
--primary-foreground: #245c46;

--text-primary: #20352c;
--text-secondary: #64756d;
--border-soft: #ddebe3;

--success: #65be91;
--warning: #f3a66a;
--danger: #ef8585;
--info: #7ab8e8;
--achievement: #f6c85f;
```

Agent có thể tinh chỉnh độ tương phản để đạt accessibility, nhưng không được đổi tinh thần xanh lá pastel nếu task không yêu cầu.

### 11.3. Typography

Ưu tiên:

- Heading: Nunito.
- Body: Be Vietnam Pro hoặc Nunito.
- Fallback phải hỗ trợ tiếng Việt tốt.

Quy tắc:

- Body tối thiểu 16px ở màn hình học.
- Không dùng font quá mảnh.
- Nội dung flashcard phải dễ đọc và có line-height thoáng.
- Không viết toàn bộ tiêu đề bằng chữ in hoa.

### 11.4. Bo góc

```text
Card chính:       24–32px
Dialog/Sheet:     24px
Button:           14–18px
Input/Select:     14–16px
Badge/Chip:       999px
```

Không bo tròn mọi thành phần cùng một mức. Component nhỏ cần bán kính nhỏ hơn card chính.

### 11.5. Shadow

Shadow phải nhẹ:

```css
box-shadow: 0 8px 24px rgba(39, 93, 70, 0.08);
```

Ưu tiên phân lớp bằng background và border nhẹ hơn shadow đậm.

### 11.6. Motion

- Thời gian phổ biến: `150–250ms`.
- Flip flashcard: `300–400ms`.
- Dùng easing tự nhiên.
- Không dùng animation liên tục gây xao nhãng.
- Tôn trọng `prefers-reduced-motion`.
- Confetti chỉ dùng nhỏ và ngắn khi hoàn thành cột mốc.

### 11.7. Component chủ đạo

#### Dashboard

- Lời chào thân thiện.
- CTA “Bắt đầu bài test hôm nay”.
- Streak.
- Bộ gần đây.
- Tiến độ tuần.
- Thẻ cần ôn.

#### Flashcard

- Card lớn, tập trung.
- Nội dung căn giữa theo chiều phù hợp.
- Có chỉ dẫn “Nhấn để lật”.
- Có tiến độ.
- Có thao tác thêm vào bộ đặc biệt.
- Không đặt quá nhiều nút trên bề mặt thẻ.

#### Quiz

- Một câu tại một thời điểm.
- Tiến độ rõ.
- Bốn đáp án bo tròn.
- Phản hồi đúng/sai bằng cả màu, icon và text.
- Không chỉ dựa vào màu.
- Sau khi chọn, hiển thị nút tiếp tục thay vì chuyển câu quá nhanh.

#### Collection card

- Bộ thông thường có cảm giác như quyển sách hoặc tập nội dung.
- Bộ đặc biệt dùng icon/emoji và màu nền nhẹ.
- Hai loại phải nhất quán về layout, chỉ khác semantic styling.

### 11.8. UI không được làm

- Không dùng xanh neon.
- Không dùng gradient dày đặc.
- Không dùng shadow đen đậm.
- Không nhồi quá nhiều KPI vào dashboard.
- Không dùng modal cho mọi thao tác.
- Không dùng animation bounce liên tục.
- Không dùng màu đỏ để gây áp lực streak.
- Không hiển thị emoji như icon duy nhất cho hành động quan trọng.
- Không tạo giao diện trẻ em trừ khi có task riêng.

---

## 12. Quy tắc component và styling

- Ưu tiên shadcn/ui làm primitive.
- Không chỉnh trực tiếp component primitive theo một màn hình cụ thể.
- Tạo variant hoặc wrapper có tên rõ nếu cần behavior riêng.
- Dùng Tailwind theo design token.
- Không lặp lại chuỗi class dài ở nhiều nơi.
- Không tạo CSS global cho style chỉ dùng trong một feature.
- Không dùng inline style trừ giá trị thực sự động.
- Không hardcode màu hex trong component sau khi token đã tồn tại.
- Component dùng chung phải có API nhỏ, rõ ràng.
- Tránh prop boolean chồng chất như `green`, `rounded`, `compact`, `special`, `playful`.
- Dùng variant semantic như `variant="success"` hoặc `tone="special"`.

### Kích thước component

- Component trên khoảng 250 dòng phải được xem xét tách nhỏ.
- Page component chỉ orchestration, không chứa toàn bộ UI và nghiệp vụ.
- Hook không được che giấu side effect khó đoán.
- Không tạo component chỉ để bọc một thẻ HTML nếu không thêm ý nghĩa.

---

## 13. Quy tắc TypeScript

- Bật strict mode.
- Không dùng `any`.
- Khi chưa biết kiểu, dùng `unknown` và narrow.
- Không dùng non-null assertion `!` nếu có thể xử lý rõ ràng.
- Public function cần kiểu trả về rõ nếu inference làm API khó hiểu.
- Ưu tiên `type` cho union và object đơn giản; dùng `interface` khi cần mở rộng công khai.
- Không tạo enum TypeScript nếu union literal đủ dùng.
- Dùng discriminated union cho trạng thái phức tạp.
- Không để type database lan trực tiếp vào toàn bộ UI nếu domain model cần khác.
- Schema Zod có thể là nguồn sinh type tại boundary.

### Naming

```text
Component:          PascalCase
Hook:               useSomething
Function/variable:  camelCase
Constant:           SCREAMING_SNAKE_CASE khi thật sự bất biến toàn cục
File component:     kebab-case.tsx
File logic:         kebab-case.ts
Database:           snake_case
Route segment:      kebab-case
```

Tên phải mô tả nghiệp vụ:

- Tốt: `generateBalancedQuiz`.
- Tránh: `handleData`, `processItems`, `doStuff`.

---

## 14. Quy tắc React và Next.js

- Server Component mặc định.
- Client Component phải nhỏ và nằm gần nơi cần tương tác.
- Không fetch cùng dữ liệu lặp lại ở nhiều component client.
- Dùng loading, error và empty state phù hợp.
- Mutation phải có trạng thái pending và lỗi.
- Không dùng `useEffect` để đồng bộ dữ liệu có thể suy ra từ props/state.
- Không đưa server secret vào biến `NEXT_PUBLIC_*`.
- Revalidate hoặc invalidate cache có chủ đích sau mutation.
- Không dùng middleware cho logic database nặng.
- Auth guard phải chạy ở server boundary thích hợp.
- Không dựa duy nhất vào redirect client để bảo vệ route.

---

## 15. Quy tắc Supabase và bảo mật

- Tách Supabase browser client và server client.
- Không import server client vào Client Component.
- Không dùng service role key trong frontend.
- RLS phải có test hoặc ít nhất migration comment rõ cho mỗi bảng.
- Query luôn giới hạn dữ liệu theo user thông qua RLS và quan hệ sở hữu.
- Không tin `user_id` gửi từ client; lấy từ session server.
- Không trả stack trace hoặc lỗi database chi tiết cho người dùng.
- Log phía server phải tránh dữ liệu nhạy cảm.
- Không ghi toàn bộ nội dung file import vào log.
- Validate UUID và ownership trước mutation.
- Dùng transaction/RPC khi thao tác nhiều bước cần tính nguyên tử.

---

## 16. Quy tắc lỗi và thông báo

Mỗi feature cần phân biệt:

- Validation error.
- Authentication error.
- Authorization error.
- Not found.
- Conflict.
- Unexpected server error.

UI cần:

- Thông báo cụ thể, dễ hiểu.
- Không hiển thị lỗi kỹ thuật thô.
- Giữ lại dữ liệu form khi lỗi có thể sửa.
- Có retry khi phù hợp.
- Có empty state với hành động tiếp theo.
- Không toast cho lỗi cần người dùng đọc kỹ; hiển thị inline hoặc error panel.

---

## 17. Accessibility

Tối thiểu:

- Keyboard navigation.
- Focus visible.
- Label cho form.
- Aria label cho icon-only button.
- Dialog focus trap.
- Màu đạt độ tương phản hợp lý.
- Trạng thái đúng/sai không chỉ thể hiện bằng màu.
- Hỗ trợ reduced motion.
- Flashcard có thao tác lật bằng bàn phím.
- Quiz đáp án dùng semantic button hoặc radio pattern phù hợp.
- Không chặn zoom trên mobile.

---

## 18. Responsive

Thiết kế mobile-first.

### Mobile

- Bottom navigation hoặc compact navigation.
- Flashcard gần toàn chiều rộng.
- CTA dễ chạm, chiều cao tối thiểu khoảng 44px.
- Bảng preview import phải có phương án scroll hoặc card view.
- Không bắt người dùng kéo ngang ở luồng học.

### Desktop

- Sidebar.
- Content width có giới hạn để không quá rộng.
- Dashboard có grid.
- Flashcard không vượt quá chiều rộng đọc thoải mái.

Không chỉ “thu nhỏ desktop” cho mobile.

---

## 19. Testing strategy

### Unit test

Ưu tiên test:

- Chuẩn hóa dữ liệu import.
- Validation số câu.
- Loại bỏ card trùng.
- Sinh đáp án nhiễu.
- Thuật toán Balanced.
- Tính streak theo timezone.
- Tính thống kê.

### Integration test

- Import preview đến ghi database.
- RLS theo user.
- Tạo quiz attempt.
- Submit và cập nhật stats.
- Tạo daily learning record.

### Component test

- Column mapper.
- Flashcard flip.
- Quiz options.
- Validation form.
- Empty/error states quan trọng.

### E2E

Luồng tối thiểu:

1. Đăng nhập.
2. Import file mẫu.
3. Tạo bộ.
4. Học thẻ.
5. Tạo bộ đặc biệt.
6. Thêm thẻ vào bộ đặc biệt.
7. Tạo bài test ít nhất 10 câu.
8. Nộp bài.
9. Xem kết quả.
10. Kiểm tra streak được cập nhật.

Không viết snapshot test lớn cho UI động.

---

## 20. Script bắt buộc

`package.json` cần có:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Agent có thể điều chỉnh lệnh theo cấu hình thực tế, nhưng `npm run check` phải tồn tại và chạy các kiểm tra chính.

---

## 21. Biến môi trường

`.env.example` tối thiểu:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Chỉ thêm biến khi code thật sự sử dụng.

Quy tắc:

- Không commit `.env.local`.
- Không đặt secret trong `NEXT_PUBLIC_*`.
- `src/lib/env.ts` phải validate env khi ứng dụng khởi động.
- Mỗi biến mới phải được thêm vào `.env.example` và tài liệu.

---

## 22. Git và commit

Mỗi task nên tạo một commit riêng, có phạm vi rõ ràng.

Ví dụ:

```text
chore: initialize project
feat: add Supabase authentication
feat: implement Excel import preview
feat: add special collections
feat: implement balanced quiz generation
feat: track daily learning streak
fix: prevent duplicate quiz options
test: cover streak timezone calculation
```

Không commit:

- `.env.local`.
- Build output.
- File tạm.
- Secret.
- Log.
- Dữ liệu người dùng thật.

Không dùng `git add .` trước khi đã xem `git status` và `git diff`.

---

## 23. Quy tắc bắt buộc dành cho agent

Trước khi thay đổi code:

1. Đọc toàn bộ `AGENTS.md`.
2. Đọc tài liệu liên quan trong `docs/` nếu đã tồn tại.
3. Kiểm tra cấu trúc hiện tại và `package.json`.
4. Xác định phạm vi task.
5. Không hỏi lại thông tin đã có trong tài liệu hoặc cuộc hội thoại.

Trong khi làm:

- Chỉ làm đúng phạm vi được yêu cầu.
- Không refactor file không liên quan.
- Không đổi design direction.
- Không cài dependency nếu platform đã giải quyết được.
- Nếu cài dependency, giải thích lý do trong báo cáo.
- Không xóa tính năng đang hoạt động.
- Không để dead code hoặc TODO mơ hồ.
- Không suppress lỗi bằng `eslint-disable`, `@ts-ignore` hoặc cast tùy tiện.
- Không sửa test để che lỗi sản phẩm.
- Không tạo mock giả trong production path.
- Không hardcode user ID, token hoặc sample secret.
- Không chạy migration destructive nếu chưa có yêu cầu rõ.
- Không tự ý đổi package manager.
- Không tự ý thay đổi schema sau khi đã có migration mà không tạo migration mới.
- Không commit khi check chưa qua, trừ khi task yêu cầu điều tra lỗi và agent báo rõ.

Trước khi hoàn thành:

```bash
npm run check
git status
git diff --stat
git diff
```

Agent phải tự xem diff chi tiết trước khi commit.

Nếu mọi kiểm tra đạt:

```bash
git add <các file liên quan>
git commit -m "<type>: <mô tả ngắn>"
```

Không dùng `git add .` một cách mù quáng. Chỉ stage file thuộc task.

---

## 24. Báo cáo cuối mỗi task

Agent phải trả về:

### Summary

Mô tả ngắn những gì đã hoàn thành.

### Files changed

Liệt kê file đã thêm, sửa hoặc xóa.

### Database changes

- Migration mới.
- Table/index/policy thay đổi.
- Cách chạy migration.

### Environment variables

Liệt kê biến mới hoặc ghi “Không có”.

### Commands executed

Liệt kê lệnh quan trọng đã chạy.

### Verification

Kết quả:

- Lint.
- Typecheck.
- Unit test.
- Build.
- E2E nếu liên quan.

### Remaining issues

Chỉ ghi vấn đề thật sự còn lại, không tạo TODO ngoài phạm vi.

### Commit

Hash và message nếu đã commit.

---

## 25. Definition of Done

Một task chỉ hoàn thành khi:

- Đúng acceptance criteria.
- Không có lỗi TypeScript.
- Không có lỗi lint.
- Test liên quan đã được thêm hoặc cập nhật.
- `npm run check` thành công.
- UI có loading, empty và error state phù hợp.
- Responsive ở mobile và desktop nếu task có UI.
- Accessibility cơ bản được đáp ứng.
- Database có RLS nếu thêm bảng.
- `.env.example` và tài liệu được cập nhật nếu cần.
- Diff không chứa thay đổi ngoài phạm vi.
- Commit có message rõ ràng.

---

## 26. Thứ tự triển khai khuyến nghị

### Phase 1 — Foundation

1. Khởi tạo Next.js, TypeScript, Tailwind và shadcn/ui.
2. Thiết lập lint, format, test, Husky và scripts.
3. Tạo app shell responsive.
4. Thiết lập design tokens.
5. Tạo placeholder routes.
6. Thiết lập Supabase clients và env validation.

### Phase 2 — Auth và database

1. Supabase Auth.
2. Profiles.
3. Schema flashcard.
4. RLS.
5. Seed development.
6. Authenticated layout và route protection.

### Phase 3 — Import và quản lý flashcard

1. File picker/dropzone.
2. Workbook parsing.
3. Sheet selector.
4. Column mapping.
5. Preview và validation.
6. Import transaction.
7. CRUD bộ và flashcard.

### Phase 4 — Bộ đặc biệt và study mode

1. CRUD bộ đặc biệt.
2. Thêm/bỏ thẻ.
3. Flashcard viewer.
4. Flip animation.
5. Shuffle và keyboard controls.

### Phase 5 — Quiz engine

1. Quiz setup.
2. Candidate pool.
3. Deduplication.
4. Balanced selection.
5. Distractor generation.
6. Quiz session.
7. Submit và result review.
8. Stats update.

### Phase 6 — Streak và analytics

1. Daily learning record.
2. Current/best streak.
3. Learning calendar.
4. Accuracy.
5. Difficult cards.
6. Quiz history.

### Phase 7 — Production hardening

1. E2E.
2. Accessibility audit.
3. Responsive polish.
4. Performance.
5. Security review.
6. Error monitoring.
7. Deploy Vercel.

---

## 27. Task đầu tiên dành cho agent

Khi dự án chưa tồn tại, agent bắt đầu bằng task sau:

```text
Read AGENTS.md completely before making changes.

Initialize the FlashLearn project using Next.js App Router, TypeScript strict mode,
Tailwind CSS, shadcn/ui, Supabase client foundations, ESLint, Prettier, Vitest,
React Testing Library, Playwright, Husky and lint-staged.

Create the scalable folder structure defined in AGENTS.md.

Implement only:
- Project configuration
- Environment validation
- Base design tokens
- Responsive authenticated app shell placeholders
- Placeholder routes
- Required npm scripts
- README setup instructions

Do not implement authentication, database migrations, Excel import, flashcard
business logic, quiz logic or streak logic in this task.

Before completing:
- Run npm run check
- Run git status
- Run git diff --stat
- Review git diff
- Fix all issues

Then stage only files created for this task and commit:

chore: initialize FlashLearn project

Report files changed, dependencies installed, commands executed, environment
variables, verification results, remaining issues and commit hash.
```

---

## 28. Khi nào tách tài liệu

Trong giai đoạn đầu, `AGENTS.md` là nguồn sự thật chính.

Khi dự án lớn hơn, agent có thể tách chi tiết sang:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/ROUTES.md`
- `docs/DESIGN.md`
- `docs/DECISIONS/*.md`

Nhưng phải tuân theo:

- `AGENTS.md` vẫn chứa các rule bắt buộc.
- Tài liệu tách ra không được mâu thuẫn với `AGENTS.md`.
- Mọi quyết định kiến trúc quan trọng cần có ADR trong `docs/DECISIONS/`.
- Không tạo tài liệu chỉ để tăng số lượng file.

---

## 29. Nguyên tắc cuối cùng

1. Đơn giản trước, mở rộng sau.
2. Tính đúng đắn trước animation.
3. Bảo mật bằng database policy, không bằng niềm tin vào client.
4. UI thân thiện nhưng không đánh đổi khả năng đọc.
5. Business logic phải kiểm thử độc lập với UI.
6. Mỗi task nhỏ, diff rõ, commit dễ rollback.
7. Không over-engineer.
8. Không sửa ngoài phạm vi.
9. Không hoàn thành khi `npm run check` còn lỗi.
10. Mọi thay đổi phải làm dự án dễ hiểu hơn cho agent tiếp theo.
