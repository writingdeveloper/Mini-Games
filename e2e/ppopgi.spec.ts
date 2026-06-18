import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Claw = any;

test.describe("뽑기 (ppopgi) claw machine", () => {
  test("hub has a JELLY CATCHER card linking to /ppopgi", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /JELLY CATCHER/ });
    await expect(link).toHaveAttribute("href", "/ppopgi");
  });

  test("the /ppopgi page embeds the game", async ({ page }) => {
    await page.goto("/ppopgi");
    await expect(page.locator('iframe[title*="JELLY CATCHER"]')).toBeVisible();
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

  test("payment → start reveals the touch controls", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await expect(page.locator("#start")).not.toHaveClass(/off/);   // single machine: payment is the entry
    await page.locator("#pay-coin").click();
    await expect(page.locator("#startbtn")).toHaveClass(/on/);
    await page.locator("#startbtn").click();
    await expect(page.locator("#pad")).toHaveClass(/on/);
    expect(await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.started)).toBe(true);
  });

  test("single machine: payment is the entry, select screen hidden", async ({ page }) => {
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await expect(page.locator("#machineselect")).toHaveClass(/off/);  // no pointless 1-card select
    await expect(page.locator("#start")).not.toHaveClass(/off/);
    await expect(page.locator("#pay-title")).toContainText("JELLY CATCHER");
  });

  test("a delivered prize is collected (count + bin)", async ({ page }) => {
    // real grab→deliver is intentionally hard + stochastic (verified by the headless physics
    // script); here we deterministically exercise the collection wiring via the debug hook.
    await page.goto("/ppopgi/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __claw?: Claw }).__claw);
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.start());
    const got = await page.evaluate(() => (window as unknown as { __claw: Claw }).__claw.forceDeliver());
    expect(got).toBeGreaterThanOrEqual(1);
    await expect(page.locator("#r-got")).toHaveText(/[1-9]/); // HUD 획득 count reflects it
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
