import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const PAGINATION_CSV = "tests/fixtures/pagination-cards.csv";

test("flashcard pagination keeps list parameters while navigating in both directions", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("pagination"));

  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(PAGINATION_CSV);
  await page.getByLabel("Tên bộ").fill("Bộ phân trang");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  const setPath = new URL(page.url()).pathname;
  await page.goto(`${setPath}?q=Từ&sort=position&filter=active&tab=regular&page=1`);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 1 / 2");
  await expect(
    page.getByRole("navigation", { name: "Phân trang" }).getByText("Trước", { exact: true }),
  ).toHaveAttribute("aria-disabled", "true");

  await page.getByRole("link", { name: "Sau" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 2 / 2");

  const pageTwo = new URL(page.url());
  expect(pageTwo.searchParams.get("q")).toBe("Từ");
  expect(pageTwo.searchParams.get("sort")).toBe("position");
  expect(pageTwo.searchParams.get("filter")).toBe("active");
  expect(pageTwo.searchParams.get("tab")).toBe("regular");

  await page.getByRole("link", { name: "Trước" }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 1 / 2");

  const pageOne = new URL(page.url());
  expect(pageOne.searchParams.get("q")).toBe("Từ");
  expect(pageOne.searchParams.get("sort")).toBe("position");
  expect(pageOne.searchParams.get("filter")).toBe("active");
  expect(pageOne.searchParams.get("tab")).toBe("regular");
});
