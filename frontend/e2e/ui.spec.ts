import { test, expect } from "@playwright/test";

test.describe("GenView UI", () => {
  test("page loads and shows chat and canvas layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("chat-input")).toBeVisible();
    await expect(page.getByTestId("chat-send")).toBeVisible();
    await expect(page.getByTestId("tab-preview")).toBeVisible();
    await expect(page.getByTestId("tab-code")).toBeVisible();
  });

  test("can type in chat input", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("chat-input");
    await input.fill("Create a simple dashboard");
    await expect(input).toHaveValue("Create a simple dashboard");
  });

  test("can switch between Preview and Code tabs", async ({ page }) => {
    await page.goto("/");
    const previewTab = page.getByTestId("tab-preview");
    const codeTab = page.getByTestId("tab-code");

    await codeTab.click();
    await expect(codeTab).toBeVisible();

    await previewTab.click();
    await expect(previewTab).toBeVisible();
  });

  test("send message shows user message in chat", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("chat-input");
    const sendBtn = page.getByTestId("chat-send");

    await input.fill("Hello");
    await sendBtn.click();

    // User message should appear (backend may or may not respond)
    await expect(page.getByText("Hello")).toBeVisible({ timeout: 5000 });
  });
});
