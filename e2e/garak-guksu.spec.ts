import { test, expect } from '@playwright/test';

test('garak-guksu route mounts with a canvas', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await expect(frame.locator('canvas#game')).toBeVisible();
});

test('hub links to garak-guksu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/garak-guksu"]')).toBeVisible();
});

test('spawns a customer, serves them via the pipeline, scores', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();

  const result = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak; const S = g.STATIONS;
    g.tickSpawns(2.5);                       // force one spawn
    const c = g.customers[0];
    // cook a perfect bowl matching the order
    g.teleport(S.setting.x, S.setting.z); g.setNoodle();
    g.teleport(S.blancher.x, S.blancher.z); g.putInBlancher();
    g.tick(2.5 * 0.8);
    g.liftFromBlancher();
    g.teleport(S.broth.x, S.broth.z); g.pourBroth();
    g.teleport(S.garnish.x, S.garnish.z); g.garnish(c.order.spice);
    // teleport to the customer's slot and serve
    const slot = [{x:-3,z:3.2},{x:-1,z:3.2},{x:1,z:3.2},{x:3,z:3.2}][c.slot];
    g.teleport(slot.x, slot.z); g.serve();
    return { score: g.score, remaining: g.customers.length };
  });
  expect(result.score).toBe(230); // (100 + 50 + 50 + 30) × 1 = 230 (patienceProgress 0 → speed 50, combo 1 → ×1)
  expect(result.remaining).toBe(0);
});

test('a timed-out customer costs a life', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();
  const lives = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    g.tickSpawns(2.5);          // one customer
    g.tickCustomers(30);        // way past any patience → walkout
    return g.lives;
  });
  expect(lives).toBe(4);
});

test('clearing all waves wins', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();
  const phase = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    // blow through every wave's dwell + intermission
    for (let i = 0; i < 12; i++) { g.tickWave(80); g.tickWave(3); }
    return g.phase;
  });
  expect(phase).toBe('won');
});

test('combo builds on correct serves and resets on a mis-serve', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();
  const r = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak; const S = g.STATIONS;
    const SLOTS = [{x:-3,z:3.2},{x:-1,z:3.2},{x:1,z:3.2},{x:3,z:3.2}];
    function cook(spice) {
      g.teleport(S.setting.x, S.setting.z); g.setNoodle();
      g.teleport(S.blancher.x, S.blancher.z); g.putInBlancher(); g.tick(2.0); g.liftFromBlancher();
      g.teleport(S.broth.x, S.broth.z); g.pourBroth();
      g.teleport(S.garnish.x, S.garnish.z); g.garnish(spice);
    }
    // two correct serves
    g.tickSpawns(2.5); let c = g.customers[g.customers.length - 1];
    cook(c.order.spice); g.teleport(SLOTS[c.slot].x, SLOTS[c.slot].z); g.serve();
    g.tickSpawns(2.5); c = g.customers[g.customers.length - 1];
    cook(c.order.spice); g.teleport(SLOTS[c.slot].x, SLOTS[c.slot].z); g.serve();
    const afterTwo = g.combo;
    // a wrong serve
    g.tickSpawns(2.5); c = g.customers[g.customers.length - 1];
    const wrong = ['none','normal','extra'].find((s) => s !== c.order.spice);
    cook(wrong); g.teleport(SLOTS[c.slot].x, SLOTS[c.slot].z); g.serve();
    return { afterTwo, afterWrong: g.combo, bestCombo: g.bestCombo };
  });
  expect(r.afterTwo).toBe(2);
  expect(r.afterWrong).toBe(0);
  expect(r.bestCombo).toBe(2);
});
