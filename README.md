# FlashLearn

Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh.

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

## Scripts

| Lệnh                   | Mô tả                                |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Chạy dev server                      |
| `npm run build`        | Build production                     |
| `npm run start`        | Chạy production build                |
| `npm run lint`         | Kiểm tra ESLint                      |
| `npm run typecheck`    | Kiểm tra TypeScript                  |
| `npm run format`       | Format toàn bộ code bằng Prettier    |
| `npm run format:check` | Kiểm tra định dạng Prettier          |
| `npm run test`         | Chạy unit test (Vitest)              |
| `npm run test:watch`   | Chạy unit test ở chế độ watch        |
| `npm run test:e2e`     | Chạy E2E test (Playwright)           |
| `npm run check`        | Lint + typecheck + unit test + build |

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
├── seed.sql
└── config.toml
tests/
├── unit/
├── integration/
├── components/
├── e2e/
└── fixtures/
```

Xem `AGENTS.md` để hiểu đầy đủ blueprint của dự án: phạm vi MVP, kiến trúc, mô hình dữ liệu,
design system và quy tắc dành cho agent.
