import { test, expect, chromium } from "@playwright/test";

declare global {
  interface Window {
    __fry?: {
      session?: {
        height: number;
        placed?: unknown[];
        azimuth?: number;
        assist?: boolean;
        paused?: boolean;
        round?: { timeLeft: number };
        bodies?: { position: { y: number }; velocity: { x: number } }[];
        _applyWobble?: () => void;
      };
    };
  }
}

test.describe("Fryffel Tower fry-stacking game", () => {
  test("hub card navigates to the game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Fryffel Tower/ }).click();
    await expect(page).toHaveURL(/\/fry-tower-game/);
    // Mode-select screen is now shown first; click through to single-player.
    await page.getByRole("button", { name: /싱글플레이어/ }).click();
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

  test("touch: tap-to-drop works on a mobile context and places fries", async ({ browser }) => {
    const mobileCtx = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await mobileCtx.newPage();

    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    // Start solo game
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();

    // Tap the canvas several times to trigger tap-to-drop; space taps apart so fries settle
    const canvas = page.locator("#game");
    for (let i = 0; i < 3; i++) {
      await canvas.tap();
      await page.waitForTimeout(1800); // let each fry fall and settle before the next tap
    }
    await page.waitForTimeout(2000); // extra settle time after last drop

    // height > 0 once at least one fry is resting on the tray
    const height = await page.evaluate(() => window.__fry?.session?.height ?? -1);
    expect(height, "tap-to-drop should produce a positive tower height").toBeGreaterThan(0);
    expect(errors, "no console errors on touch: " + errors.join("\n")).toHaveLength(0);

    await mobileCtx.close();
  });

  test("hand controls place fries in 3D (depth/yaw/tilt/orbit) without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();
    await page.waitForTimeout(800); // let the hand settle holding the first fry

    // Exercise the 3D placement controls: depth, yaw, tilt, camera orbit, X.
    for (const key of ["ArrowUp", "KeyQ", "KeyZ", "BracketRight", "ArrowLeft"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(150);
      await page.keyboard.up(key);
    }

    // Place several fries with the hand (Space releases; a fresh fry is grabbed).
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(700); // > respawnBeat so the next fry is in hand
    }
    await page.waitForTimeout(1200); // settle

    const placed = await page.evaluate(
      () => window.__fry?.session?.placed?.length ?? 0
    );
    expect(placed, "hand should have placed at least one fry").toBeGreaterThan(0);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("touch: 🔄 view button rotates the camera (arm follows via azimuth)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();
    await page.waitForTimeout(700); // settle

    const before = await page.evaluate(
      () => window.__fry?.session?.azimuth ?? 0
    );
    await page.locator("#view-btn").tap();
    await page.waitForTimeout(700); // let the camera lerp to the next preset

    const after = await page.evaluate(
      () => window.__fry?.session?.azimuth ?? 0
    );
    expect(
      Math.abs(after - before),
      "view button should change the camera azimuth"
    ).toBeGreaterThan(0.05);
    expect(errors, errors.join("\n")).toHaveLength(0);

    await ctx.close();
  });

  test("challenge: wobble applies a height-scaled sideways impulse to the tower", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();

    // Drop a few fries so the tower has bodies.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(800);

    // Lift the tower above the wobble threshold and force a wobble; assert it
    // imparts horizontal velocity (the impulse path runs) with no error.
    const wobbled = await page.evaluate(() => {
      const s = window.__fry?.session;
      if (!s || !s.bodies || !s.bodies.length) return false;
      for (const b of s.bodies) b.position.y += 2.5;
      const before = s.bodies.map((b) => b.velocity.x);
      s._applyWobble?.();
      const after = s.bodies.map((b) => b.velocity.x);
      return after.some((v, i) => v !== before[i]);
    });

    expect(wobbled, "forced wobble should change body velocities").toBe(true);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("help overlay: opens, pauses the round, toggles assist, closes", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();
    await page.waitForTimeout(500);

    // Open help -> overlay visible + round paused (timeLeft frozen).
    await page.locator("#help-btn").click();
    await expect(page.locator("#help-overlay")).toBeVisible();
    const t1 = await page.evaluate(
      () => window.__fry?.session?.round?.timeLeft ?? -1
    );
    await page.waitForTimeout(700);
    const t2 = await page.evaluate(
      () => window.__fry?.session?.round?.timeLeft ?? -1
    );
    expect(t2).toBe(t1); // paused: timer did not advance

    // Toggle assist on.
    await page.locator("#assist-toggle").click();
    const assistOn = await page.evaluate(
      () => !!window.__fry?.session?.assist
    );
    expect(assistOn).toBe(true);

    // Close -> overlay hidden + round resumes (timer advances).
    await page.locator("#help-close").click();
    await expect(page.locator("#help-overlay")).toBeHidden();
    await page.waitForTimeout(700);
    const t3 = await page.evaluate(
      () => window.__fry?.session?.round?.timeLeft ?? -1
    );
    expect(t3).toBeLessThan(t2);

    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("multi-mode bootstrap runs and recovers gracefully when server is unreachable", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/fry-tower-game/index.html?mode=multi&server=https://example.invalid");
    // Allow time for the socket.io script load to fail and the onerror handler to fire.
    await page.waitForTimeout(3000);

    // Bootstrap either showed the lobby overlay (socket.io loaded) or restored #menu (onerror path).
    const lobbyVisible = await page.locator(".lobby-overlay").isVisible();
    const menuVisible = await page.locator("#menu").isVisible();
    expect(lobbyVisible || menuVisible, "expected lobby-overlay or #menu to be visible").toBe(true);
    expect(pageErrors, pageErrors.join("\n")).toHaveLength(0);
  });
});
