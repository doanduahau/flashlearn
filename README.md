# FlashLearn

## Import CSV/XLSX

The import page accepts `.csv` and `.xlsx` files up to 5 MB. Parsing happens in browser memory and FlashLearn never stores the original source file. Users select a worksheet and two distinct columns, review normalized rows, then confirm one atomic set import. Blank and partial pairs are excluded; exact normalized duplicates retain only their first occurrence; imports reject more than 2,000 valid rows.

## Quiz

Quiz sessions are resumable server-owned multiple-choice plans built from regular sets, special collections or all cards. They support Balanced, Never Tested, Wrong Answers and Pure Random selection and preserve question/answer snapshots in result history. See `docs/QUIZ.md` for selection, limits and security details.

## Statistics and streaks

`/statistics` derives activity, accuracy and quiz mode totals only from completed quiz sessions. A streak uses the profile timezone and counts at most one active local day per calendar day. See `docs/STATISTICS.md`.

## Quản lý bộ và thẻ

Bộ flashcard thông thường được tạo qua import. Trang `/sets` liệt kê các bộ kèm số thẻ và ô tìm kiếm; trang `/sets/[setId]` cho phép đổi tên bộ, xóa bộ, thêm/sửa/xóa thẻ, tìm kiếm và phân trang. Thẻ mới được thêm vào cuối bộ với vị trí do database gán (an toàn khi thêm đồng thời). Mọi thao tác chỉ tác động lên dữ liệu của chính người dùng, được bảo vệ bằng RLS. Sắp xếp lại thẻ và tạo bộ trống bằng tay nằm ngoài phạm vi hiện tại.

## Bộ đặc biệt

Bộ đặc biệt gom thẻ từ nhiều bộ flashcard thông thường mà không sao chép nội dung. Trang `/collections` cho phép tạo, tìm và liệt kê các bộ kèm số thẻ; trang `/collections/[collectionId]` cho phép đổi tên, xóa bộ và bỏ thẻ khỏi bộ. Tại trang `/sets/[setId]`, mỗi thẻ có bộ điều khiển để thêm/bớt thẻ khỏi một hoặc nhiều bộ đặc biệt. Tên bộ đặc biệt phải là duy nhất theo từng người dùng (không phân biệt hoa thường), do database đảm bảo. Khi flashcard gốc được sửa, thay đổi hiển thị ở mọi bộ đặc biệt chứa thẻ đó.

Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh.

## Chế độ học (Study mode)

Trang `/study` cho phép chọn phạm vi học: tất cả thẻ, hoặc một tổ hợp bộ flashcard và bộ đặc biệt. Hệ thống tính số thẻ duy nhất (gộp các nguồn, loại trùng theo flashcard) trước khi bắt đầu. Phiên học tại `/study/session` hiển thị mặt trước, lật để xem mặt sau, có thẻ trước/tiếp theo, trộn thứ tự và bộ điều khiển thêm/bớt thẻ khỏi bộ đặc biệt ngay trong phiên. Hỗ trợ bàn phím (Space/Enter lật, mũi tên chuyển thẻ). Phiên được suy ra hoàn toàn từ query — tải lại trang không mất vị trí. Chi tiết xem `docs/STUDY.md`.

Học ngoại ngữ, lập trình, công thức, luật, y khoa, câu hỏi phỏng vấn — bất kỳ nội dung hỏi–đáp nào
biểu diễn được bằng hai cột.

## Công nghệ

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript strict
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) (Auth, PostgreSQL, Row Level Security)
- [Vitest](https://vitest.dev) + React Testing Library, [Playwright](https://playwright.dev)
- [ESLint](https://eslint.org) + [Prettier](https://prettier.io) + [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged)

## Yêu cầu

- Node.js ≥ 20
- npm

## Cài đặt (Settings)

Trang `/settings` cho phép người dùng cập nhật hồ sơ: email đăng nhập ở dạng chỉ đọc, tên
hiển thị (tùy chọn, để trống sẽ dùng email) và múi giờ IANA (mặc định `Asia/Ho_Chi_Minh`).
Múi giờ được dùng để tính chuỗi học và thống kê theo ngày địa phương; trang hiển thị giờ địa
phương của múi giờ đang chọn. Thay đổi hồ sơ được thực hiện qua RPC `update_profile` với
kiểm tra sở hữu và validate múi giờ ở database boundary. Đổi email, mật khẩu, avatar và
thông báo nằm ngoài phạm vi hiện tại.

## Cài đặt

```bash
npm install
cp .env.example .env.local
```

Sau đó điền các giá trị vào `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Phát triển

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Database (Supabase local)

Cần Docker Desktop đang chạy. Các lệnh dùng CLI Supabase qua npm scripts:

```bash
npm run supabase:start    # khởi động stack Supabase local (Postgres, Auth, Studio)
npm run supabase:stop     # dừng stack
npm run db:reset          # build lại database từ migrations + seed
npm run db:test           # chạy pgTAP test (supabase/tests/*.sql)
npm run db:types          # sinh lại src/lib/supabase/types.ts
```

- Studio UI: <http://localhost:54323>
- Postgres local: `localhost:54322` (postgres/postgres)
- Tạo user trong Studio → Authentication (hoặc đăng ký từ app); trigger
  `handle_new_user` tự tạo `profiles` tương ứng.
- Chi tiết schema, constraints, RLS và grants xem `docs/DATABASE.md`.

## Scripts

| Lệnh                     | Mô tả                                |
| ------------------------ | ------------------------------------ |
| `npm run dev`            | Chạy dev server                      |
| `npm run build`          | Build production                     |
| `npm run start`          | Chạy production build                |
| `npm run lint`           | Kiểm tra ESLint                      |
| `npm run typecheck`      | Kiểm tra TypeScript                  |
| `npm run format`         | Format toàn bộ code bằng Prettier    |
| `npm run format:check`   | Kiểm tra định dạng Prettier          |
| `npm run test`           | Chạy unit test (Vitest)              |
| `npm run test:watch`     | Chạy unit test ở chế độ watch        |
| `npm run test:e2e`       | Chạy E2E test (Playwright)           |
| `npm run check`          | Lint + typecheck + unit test + build |
| `npm run supabase:start` | Khởi động Supabase local             |
| `npm run supabase:stop`  | Dừng Supabase local                  |
| `npm run db:reset`       | Reset database local                 |
| `npm run db:test`        | Chạy pgTAP test database             |
| `npm run db:types`       | Sinh TypeScript types từ database    |

Playwright cần cài browser lần đầu:

```bash
npx playwright install chromium
```

## Cấu trúc dự án

```
src/
├── app/               # Route groups: (marketing), (auth), (app)
├── components/        # ui/ (shadcn), layout/, shared/
├── features/          # Feature-first: auth, imports, quiz, streak, ...
├── hooks/
├── lib/               # env, supabase clients, utils, logger, constants
├── styles/
└── types/
supabase/
├── migrations/        # SQL migrations
├── tests/             # pgTAP database tests
├── seed.sql
└── config.toml
docs/
├── ARCHITECTURE.md    # Kiến trúc tổng quan
├── AUTH.md            # Auth flow and security
├── DATABASE.md        # Schema, RLS, constraints, commands
├── DEPLOYMENT.md      # Deployment guide for free-tier beta
├── DECISIONS/         # ADRs
└── QA/                # Báo cáo QA
tests/
├── unit/
├── integration/
├── components/
├── e2e/
└── fixtures/
```

Xem `AGENTS.md` để hiểu đầy đủ blueprint của dự án: phạm vi MVP, kiến trúc, mô hình dữ liệu,
design system và quy tắc dành cho agent.
