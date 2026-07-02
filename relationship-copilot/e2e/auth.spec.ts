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
});
