import { test, expect } from "@playwright/test";

test.describe("Tantrum Tower construction game", () => {
  test("hub card navigates to the game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Tantrum Tower/ }).click();
    await expect(page).toHaveURL(/\/construction-game/);
    await expect(page.locator('iframe[title*="Tantrum Tower"]')).toBeVisible();
  });

  test("game canvas mounts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/construction-game/index.html");
    await expect(page.locator("canvas#game")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("gameplay runs without console errors after starting", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/construction-game/index.html");
    await page.locator("#start-btn").click();
    // drive movement, every tactic, and a pause/resume cycle
    for (const key of ["KeyW", "Digit1", "KeyD", "Digit2", "KeyA", "Digit3", "Escape", "Escape"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1000);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
