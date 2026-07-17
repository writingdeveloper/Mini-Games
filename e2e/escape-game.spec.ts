import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Escape = any;
const carY = () => (window as unknown as { __escape: Escape }).__escape.car.y;

test.describe("도주 게임 (escape)", () => {
  test("hub has a 도주 게임 card linking to /escape-game", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /도주 게임/ });
    await expect(link).toHaveAttribute("href", "/escape-game");
  });

  test("with no multiplayer server, /escape-game boots straight to the game (no mode picker, no dev error)", async ({ page }) => {
    await page.goto("/escape-game");
    await expect(page.locator('iframe[title="도주 게임"]')).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("플레이 모드를 선택");
    expect(body).not.toContain("서버가 설정되지 않았습니다");
  });

  test("game mounts without console errors and exposes the debug hook", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/escape-game/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __escape?: Escape }).__escape, null, { timeout: 8000 });
    await expect(page.locator("#startScreen")).toBeVisible(); // canvas lives in #gameScreen, hidden until start
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("keyboard: ArrowUp drives the car upward", async ({ page }) => {
    await page.goto("/escape-game/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __escape?: Escape }).__escape);
    await page.locator("#startButton").click();
    const y0 = await page.evaluate(carY);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(450);
    const y1 = await page.evaluate(carY);
    expect(y1).toBeLessThan(y0);
  });

  test("mobile: the on-screen d-pad exists and its buttons steer the car", async ({ page }) => {
    await page.goto("/escape-game/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __escape?: Escape }).__escape);
    for (const dir of ["up", "down", "left", "right"]) {
      await expect(page.locator(`#dpad .${dir}`)).toHaveCount(1);
    }
    await page.locator("#startButton").click();
    const y0 = await page.evaluate(carY);
    // pointerdown fires the same _turn() as the arrow keys, regardless of CSS visibility
    await page.locator("#dpad .up").dispatchEvent("pointerdown");
    await page.waitForTimeout(450);
    const y1 = await page.evaluate(carY);
    expect(y1).toBeLessThan(y0);
  });
});
