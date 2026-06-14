import { test, expect } from "@playwright/test";
import http from "node:http";

// Live 2-player multiplayer verification (real socket.io). Requires the game server on :3001
// (`npm --prefix server run dev`). SKIPS gracefully when the server isn't reachable (e.g. CI
// without a server) so the standard e2e gate stays green. Next is served on :3099 by webServer.
const SERVER = "http://localhost:3001";
const MP_URL = `/fry-tower-game/index.html?mode=multi&server=${encodeURIComponent(SERVER)}`;

function serverReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER}/socket.io/?EIO=4&transport=polling`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

test("2-player: room, live height relay, best-of rounds to match end", async ({ browser }) => {
  test.skip(!(await serverReachable()), "game server :3001 not reachable — run `npm --prefix server run dev`");
  test.setTimeout(90_000);

  const ctxA = await browser.newContext({ baseURL: "http://localhost:3099" });
  const ctxB = await browser.newContext({ baseURL: "http://localhost:3099" });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const errA: string[] = []; const errB: string[] = [];
  A.on("console", (m) => m.type() === "error" && errA.push(m.text()));
  A.on("pageerror", (e) => errA.push("PAGEERR " + e.message));
  B.on("console", (m) => m.type() === "error" && errB.push(m.text()));
  B.on("pageerror", (e) => errB.push("PAGEERR " + e.message));

  await A.goto(MP_URL); await B.goto(MP_URL);
  await expect(A.locator(".lobby-overlay")).toBeVisible({ timeout: 15000 });
  await expect(B.locator(".lobby-overlay")).toBeVisible({ timeout: 15000 });

  // A creates a room; B joins by code.
  await A.locator("#btnMultiPlayer").click();
  await A.locator("#btnCreateRoom").click();
  await expect(A.locator("#viewWaiting")).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => (await A.locator("#lobbyCodeDisplay").textContent())?.trim(), { timeout: 15000 }).not.toBe("------");
  const code = (await A.locator("#lobbyCodeDisplay").textContent())!.trim();
  expect(code).toHaveLength(6);
  await B.locator("#btnMultiPlayer").click();
  await B.locator("#lobbyRoomCode").fill(code);
  await B.locator("#btnJoinRoom").click();
  await expect(B.locator("#viewWaiting")).toBeVisible({ timeout: 15000 });

  // B readies, host A starts.
  await B.locator("#btnReady").click();
  await expect(A.locator("#btnStartGame")).toBeVisible({ timeout: 15000 });
  await A.locator("#btnStartGame").click();
  await expect(A.locator("#hud")).toBeVisible({ timeout: 20000 });
  await expect(B.locator("#hud")).toBeVisible({ timeout: 20000 });
  await A.waitForTimeout(800);

  // Both drop fries -> report height -> server relays to the other.
  for (let i = 0; i < 6; i++) { await A.keyboard.press("Space"); await B.keyboard.press("Space"); await A.waitForTimeout(300); }
  await A.waitForTimeout(1500);

  // CORE: each client sees the other with a real (>0) height via the server.
  await expect(A.locator("#opponents .opp")).toHaveCount(1, { timeout: 15000 });
  await expect(B.locator("#opponents .opp")).toHaveCount(1, { timeout: 15000 });
  await expect.poll(async () => {
    const m = ((await A.locator("#opponents").textContent()) || "").match(/([\d.]+)m/);
    return m ? parseFloat(m[1]) : 0;
  }, { timeout: 15000, message: "opponent height should relay > 0" }).toBeGreaterThan(0);

  // Fast-forward all rounds (each client's round timer) to reach match end.
  let ended = false;
  for (let r = 1; r <= 3; r++) {
    await A.evaluate(() => { const s = (window as unknown as { __fry?: { session?: { round: { timeLeft: number } } } }).__fry?.session; if (s) s.round.timeLeft = 0.4; });
    await B.evaluate(() => { const s = (window as unknown as { __fry?: { session?: { round: { timeLeft: number } } } }).__fry?.session; if (s) s.round.timeLeft = 0.4; });
    await A.waitForTimeout(2500);
    const title = (await A.locator("#result-title").textContent().catch(() => "")) || "";
    if (/경기 종료/.test(title)) { ended = true; break; }
  }
  expect(ended, "best-of match should reach 경기 종료").toBe(true);

  expect(errA, "A console errors:\n" + errA.join("\n")).toHaveLength(0);
  expect(errB, "B console errors:\n" + errB.join("\n")).toHaveLength(0);
  await ctxA.close(); await ctxB.close();
});
