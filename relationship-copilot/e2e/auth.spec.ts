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

test("primary authentication action meets WCAG AA contrast", async ({
  page,
}) => {
  await page.goto("/login");

  const contrastRatio = await page
    .getByRole("button", { name: "Email me a sign-in link" })
    .evaluate((button) => {
      const styles = getComputedStyle(button);
      const parseRgb = (color: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas color conversion unavailable");
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };
      const luminance = (color: string) => {
        const channels = parseRgb(color).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });

        return (
          0.2126 * channels[0] +
          0.7152 * channels[1] +
          0.0722 * channels[2]
        );
      };
      const foreground = luminance(styles.color);
      const background = luminance(styles.backgroundColor);

      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });

  expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
});

test("magic link signs the requested user into the application", async ({
  page,
  request,
}) => {
  const email = `playwright-${Date.now()}@example.test`;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Check your inbox for the sign-in link.",
  );

  await expect
    .poll(async () => {
      const response = await request.get("http://127.0.0.1:54324/api/v1/messages");
      if (!response.ok()) return null;
      const body = (await response.json()) as {
        messages?: Array<{
          ID: string;
          To?: Array<{ Address?: string }>;
        }>;
      };
      return (
        body.messages?.find((message) =>
          message.To?.some((recipient) => recipient.Address === email),
        )?.ID ?? null
      );
    }, { timeout: 10_000 })
    .not.toBeNull();

  const messagesResponse = await request.get(
    "http://127.0.0.1:54324/api/v1/messages",
  );
  const messages = (await messagesResponse.json()) as {
    messages: Array<{
      ID: string;
      To?: Array<{ Address?: string }>;
    }>;
  };
  const matchingMessage = messages.messages.find((message) =>
    message.To?.some((recipient) => recipient.Address === email),
  );
  if (!matchingMessage) throw new Error("Magic-link email was not delivered");

  const messageResponse = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${matchingMessage.ID}`,
  );
  const message = (await messageResponse.json()) as { HTML?: string };
  const link = message.HTML?.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1];
  if (!link) throw new Error("Magic-link email did not use the application route");

  let confirmationSetSessionCookie = false;
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname === "/auth/confirm") {
      confirmationSetSessionCookie = Boolean(
        (await response.allHeaders())["set-cookie"]?.includes("sb-"),
      );
    }
  });
  await page.goto(link.replaceAll("&amp;", "&"));
  expect(confirmationSetSessionCookie).toBe(true);
  expect(
    (await page.context().cookies()).some((cookie) => cookie.name.startsWith("sb-")),
  ).toBe(true);
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", {
      name: "Your relationship memory starts with trusted context.",
    }),
  ).toBeVisible();
});
