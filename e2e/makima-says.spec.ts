import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type M = any;

test.describe("마키마 says", () => {
  test("hub has a card linking to /makima-says", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /마키마 says/ })).toHaveAttribute("href", "/makima-says");
  });

  test("the route embeds the game", async ({ page }) => {
    await page.goto("/makima-says");
    await expect(page.locator('iframe[title="마키마 says"]')).toBeVisible();
  });

  test("game mounts and a round starts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/makima-says/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __makima?: M }).__makima, null, { timeout: 8000 });
    await page.getByRole("button", { name: "시작" }).click();
    await page.waitForFunction(() => !!(window as unknown as { __makima: M }).__makima.command, null, { timeout: 4000 });
    expect(await page.evaluate(() => (window as unknown as { __makima: M }).__makima.running)).toBe(true);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("obeying 마키마 scores; obeying 레제 costs a life", async ({ page }) => {
    await page.goto("/makima-says/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __makima?: M }).__makima);
    await page.getByRole("button", { name: "시작" }).click();

    // Drive ~8 rounds: obey makima (press shown dir), resist reze (press nothing).
    for (let i = 0; i < 8; i++) {
      const cmd = await page.evaluate(() => (window as unknown as { __makima: M }).__makima.command);
      if (cmd && cmd.speaker === "makima") {
        await page.evaluate((d) => (window as unknown as { __makima: M }).__makima._forceInput(d), cmd.dir);
        await page.waitForTimeout(500);
      } else {
        await page.waitForTimeout(900); // let reze's window elapse untouched
      }
    }
    const st = await page.evaluate(() => {
      const m = (window as unknown as { __makima: M }).__makima;
      return { score: m.score, lives: m.lives };
    });
    expect(st.score).toBeGreaterThan(0);
    expect(st.lives).toBeGreaterThan(0);
  });
});
