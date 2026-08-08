import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test("Study and Quiz source selection scales across pages on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndConfirm(page, uniqueEmail("source_scale"));

  for (let index = 1; index <= 13; index += 1) {
    await page.goto("/sets?create=manual");
    await page.getByLabel("Tên bộ flashcard").fill(`Nguồn lớn ${index}`);
    await page.getByLabel("Mặt trước").fill(`Mặt trước ${index}`);
    await page.getByLabel("Mặt sau").fill(`Mặt sau ${index}`);
    await page.getByRole("button", { name: "Tạo bộ" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  }

  await page.goto("/sets?tab=special");
  await page.getByRole("button", { name: /Tạo bộ đặc biệt/ }).click();
  await page.getByLabel("Tên bộ").fill("Nguồn đặc biệt");
  await page.getByRole("button", { name: /^Tạo bộ$/ }).click();

  await page.goto("/study?sourceType=regular");
  await expect(page.getByRole("navigation", { name: "Phân trang nguồn" })).toContainText(
    "Trang 1 / 2",
  );
  await page.getByRole("checkbox", { name: /^Nguồn lớn 1,/ }).check();
  await expect(page.getByLabel("Nguồn đã chọn")).toHaveText("Nguồn lớn 1");
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(page).toHaveURL(/sourceType=regular.*page=2|page=2.*sourceType=regular/);
  await expect(page.getByLabel("Nguồn đã chọn")).toHaveText("Nguồn lớn 1");

  await page.getByLabel("Tìm nguồn theo tên").fill("Nguồn lớn 13");
  await page.getByRole("button", { name: "Tìm" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Nguồn lớn 13");
  await expect(page.getByText("Nguồn lớn 13")).toBeVisible();
  await page.getByLabel("Tìm nguồn theo tên").fill("");
  await page.getByRole("button", { name: "Tìm" }).click();
  await page.getByRole("button", { name: "Bộ đặc biệt" }).click();
  await expect(page).toHaveURL(/sourceType=special/);
  await expect(page.getByText("Nguồn đặc biệt")).toBeVisible();

  const studyAction = page.getByRole("button", { name: "Bắt đầu học" });
  await expect(studyAction).toBeVisible();
  expect((await studyAction.boundingBox())?.y ?? 0).toBeLessThan(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await page.goto("/quiz?sourceType=regular");
  await expect(page.getByText("Có 13 thẻ hợp lệ trong phạm vi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "10" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "20" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "30" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "50" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Bắt đầu kiểm tra" })).toBeVisible();
});
