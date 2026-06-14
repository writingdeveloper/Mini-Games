import { test, expect } from "@playwright/test";
import http from "node:http";

// Live 2-player sabotage verification. Requires the game server on :3001
// (`npm --prefix server run dev`). SKIPS gracefully when the server isn't reachable.
const SERVER = "http://localhost:3001";
const MP = `/fry-tower-game/index.html?mode=multi&server=${encodeURIComponent(SERVER)}`;

function serverReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER}/socket.io/?EIO=4&transport=polling`, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

test("sabotage: charge -> fire -> server relay -> only the target is affected", async ({ browser }) => {
  test.skip(!(await serverReachable()), "game server :3001 not reachable — run `npm --prefix server run dev`");
  test.setTimeout(120_000);

  const ctxA = await browser.newContext({ baseURL: "http://localhost:3099" });
  const ctxB = await browser.newContext({ baseURL: "http://localhost:3099" });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const errA: string[] = []; const errB: string[] = [];
  A.on("console", (m) => m.type() === "error" && errA.push(m.text()));
  A.on("pageerror", (e) => errA.push("PAGEERR " + e.message));
  B.on("console", (m) => m.type() === "error" && errB.push(m.text()));
  B.on("pageerror", (e) => errB.push("PAGEERR " + e.message));

  await A.goto(MP); await B.goto(MP);
  await expect(A.locator(".lobby-overlay")).toBeVisible({ timeout: 15000 });
  await expect(B.locator(".lobby-overlay")).toBeVisible({ timeout: 15000 });
  await A.locator("#btnMultiPlayer").click();
  await A.locator("#btnCreateRoom").click();
  await expect.poll(async () => (await A.locator("#lobbyCodeDisplay").textContent())?.trim(), { timeout: 15000 }).not.toBe("------");
  const code = (await A.locator("#lobbyCodeDisplay").textContent())!.trim();
  await B.locator("#btnMultiPlayer").click();
  await B.locator("#lobbyRoomCode").fill(code);
  await B.locator("#btnJoinRoom").click();
  await expect(B.locator("#viewWaiting")).toBeVisible({ timeout: 15000 });
  await B.locator("#btnReady").click();
  await expect(A.locator("#btnStartGame")).toBeVisible({ timeout: 15000 });
  await A.locator("#btnStartGame").click();
  await expect(A.locator("#hud")).toBeVisible({ timeout: 20000 });
  await expect(B.locator("#hud")).toBeVisible({ timeout: 20000 });
  await A.waitForTimeout(900);

  // B builds a small tower (bodies for gust/seagull + height); B never fires.
  for (let i = 0; i < 4; i++) { await B.keyboard.press("Space"); await B.waitForTimeout(350); }
  await A.waitForTimeout(800);

  // A force-charges and fires at the leading opponent (B) repeatedly.
  let fires = 0; let ketchupOnB = false; let ketchupOnA = false;
  for (let i = 0; i < 16; i++) {
    await A.evaluate(() => { const s = (window as unknown as { __fry?: { session?: { combo: { charge: number } } } }).__fry?.session; if (s) s.combo.charge = 9; });
    const fireBtn = A.locator("#fire-sabotage");
    try { await fireBtn.waitFor({ state: "visible", timeout: 2500 }); } catch { continue; }
    await fireBtn.click();
    fires++;
    await A.waitForTimeout(250);
    if (await B.locator("#ketchup-splat").isVisible().catch(() => false)) ketchupOnB = true;
    if (await A.locator("#ketchup-splat").isVisible().catch(() => false)) ketchupOnA = true;
  }

  expect(errA, "A console errors:\n" + errA.join("\n")).toHaveLength(0);
  expect(errB, "B console errors:\n" + errB.join("\n")).toHaveLength(0);
  expect(fires, "A should grant + fire sabotage repeatedly").toBeGreaterThanOrEqual(6);
  expect(ketchupOnB, "B (target) should receive at least one ketchup over many fires — relay works").toBe(true);
  expect(ketchupOnA, "A (firer, never targeted) must never be ketchup'd — target-only relay").toBe(false);

  await ctxA.close(); await ctxB.close();
});
