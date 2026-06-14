import { test, expect } from "@playwright/test";

declare global {
  interface Window { __fry?: { session?: { height: number } }; }
}

test.describe("Fryffel Tower fry-stacking game", () => {
  test("hub card navigates to the game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Fryffel Tower/ }).click();
    await expect(page).toHaveURL(/\/fry-tower-game/);
    await expect(page.locator('iframe[title*="Fryffel Tower"]')).toBeVisible();
  });

  test("game canvas mounts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/fry-tower-game/index.html");
    await expect(page.locator("canvas#game")).toBeVisible();
    await page.waitForTimeout(1500); // allow boot
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("a solo round starts, places fries, and tracks height with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();

    // Drop a few fries.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1200); // let them settle

    const height = await page.evaluate(() => window.__fry?.session?.height ?? -1);
    expect(height).toBeGreaterThan(0);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
