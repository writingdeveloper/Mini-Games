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
  expect(result.score).toBe(180); // 100 + 50 + 30
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
