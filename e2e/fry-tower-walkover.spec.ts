import { test, expect } from "@playwright/test";
import http from "node:http";

// Live 2-player walkover verification: a mid-match disconnect must end the match cleanly
// for the survivor (explicit forfeit overlay), not silently race the remaining rounds.
// Requires the game server on :3001 (`npm --prefix server run dev`). Skips if unreachable.
const SERVER = "http://localhost:3001";
const MP = `/fry-tower-game/index.html?mode=multi&server=${encodeURIComponent(SERVER)}`;

function serverReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER}/socket.io/?EIO=4&transport=polling`, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

test("walkover: mid-match disconnect ends the match cleanly for the survivor", async ({ browser }) => {
  test.skip(!(await serverReachable()), "game server :3001 not reachable — run `npm --prefix server run dev`");
  test.setTimeout(90_000);

  const ctxA = await browser.newContext({ baseURL: "http://localhost:3099" });
  const ctxB = await browser.newContext({ baseURL: "http://localhost:3099" });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const errA: string[] = [];
  A.on("console", (m) => m.type() === "error" && errA.push(m.text()));
  A.on("pageerror", (e) => errA.push("PAGEERR " + e.message));

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

  // Both play briefly, then B abruptly leaves (disconnect mid-match).
  for (let i = 0; i < 3; i++) { await A.keyboard.press("Space"); await B.keyboard.press("Space"); await A.waitForTimeout(300); }
  await ctxB.close();

  // A gets an explicit walkover/forfeit result overlay, match ended, no console errors.
  await expect(A.locator("#result")).toBeVisible({ timeout: 15000 });
  const detail = ((await A.locator("#result-detail").textContent().catch(() => "")) || "") + ((await A.locator("#result-title").textContent().catch(() => "")) || "");
  expect(detail, "should show a walkover/forfeit message").toMatch(/부전승|나갔|forfeit|walkover/i);
  expect(errA, "A console errors:\n" + errA.join("\n")).toHaveLength(0);

  await ctxA.close();
});
