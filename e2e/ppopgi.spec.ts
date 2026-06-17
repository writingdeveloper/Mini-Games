import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Claw = any;

test.describe("뽑기 (ppopgi) claw machine", () => {
  test("hub has a POTATO CATCHER card linking to /ppopgi", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /POTATO CATCHER/ });
    await expect(link).toHaveAttribute("href", "/ppopgi");
  });

  test("the /ppopgi page embeds the game", async ({ page }) => {
    await page.goto("/ppopgi");
    await expect(page.locator('iframe[title*="POTATO CATCHER"]')).toBeVisible();
  });

  test("game mounts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ppopgi/index.html");
    await expect(page.locator("canvas#game")).toBeVisible();
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw, null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("machine select → payment → start reveals the touch controls", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await page.locator("#machinecards .mcard").first().click();   // pick a machine
    await expect(page.locator("#start")).not.toHaveClass(/off/);
    await page.locator("#pay-coin").click();
    await expect(page.locator("#startbtn")).toHaveClass(/on/);
    await page.locator("#startbtn").click();
    await expect(page.locator("#pad")).toHaveClass(/on/);
    expect(await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.started)).toBe(true);
  });

  test("machine select offers both machines", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await expect(page.locator("#machinecards .mcard")).toHaveCount(2);
    await expect(page.locator("#machinecards")).toContainText("POTATO CATCHER");
    await expect(page.locator("#machinecards")).toContainText("JELLY CATCHER");
  });

  test("grabbing a prize collects it into the bin", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.start());
    for (let i = 0; i < 14; i++) {
      const done = await page.evaluate(() => {
        const c = (window as unknown as { __claw: Claw }).__claw;
        if (c.delivered >= 1) return true;
        const p = c.piles();
        if (!p.length) return false;
        p.sort((a: { value: number }, b: { value: number }) => b.value - a.value);
        const k = p[2] ?? p[0];
        c.setHand(k.x, k.z);
        return false;
      });
      if (done) break;
      await page.waitForTimeout(180);
      await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.drop());
      await page.waitForFunction(() => (window as unknown as { __claw: Claw }).__claw.state === "aim", null, { timeout: 12000 });
    }
    expect(await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.delivered)).toBeGreaterThanOrEqual(1);
  });

  test("camera preset changes the angle", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    const before = await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.camPitch);
    await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.setCam("top"));
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.camPitch);
    expect(after).toBeGreaterThan(before + 0.2);
  });

  test("time-up shows the result overlay", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.start());
    await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.end());
    await expect(page.locator("#gameover")).not.toHaveClass(/off/);
  });
});
