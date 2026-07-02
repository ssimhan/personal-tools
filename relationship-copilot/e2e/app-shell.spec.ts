import { expect, test } from "@playwright/test";

test("welcome shell is usable at a narrow mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const heading = page.getByRole("heading", {
    name: "Remember people, clearly.",
  });
  const signIn = page.getByRole("link", { name: "Sign in" });

  await expect(heading).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(signIn).toBeVisible();

  const signInBounds = await signIn.boundingBox();
  expect(signInBounds?.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press("Tab");
  await expect(signIn).toBeFocused();

  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toContain("user-scalable=no");
  expect(viewport).not.toContain("maximum-scale=1");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
