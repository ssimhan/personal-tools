import { expect, test } from "@playwright/test";

test("signed-out visitors are redirected to login", async ({ page }) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in with your email." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link" }),
  ).toBeVisible();

  const buttonBounds = await page
    .getByRole("button", { name: "Email me a sign-in link" })
    .boundingBox();
  expect(buttonBounds?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("h1")).toHaveCount(1);
});
