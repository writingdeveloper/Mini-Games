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

test('full cooking pipeline scores completeness + accuracy', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();

  const result = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    const S = g.STATIONS;
    g.teleport(S.setting.x, S.setting.z); g.setNoodle();
    g.teleport(S.blancher.x, S.blancher.z); g.putInBlancher();
    g.tick(2.5 * 0.8);
    g.liftFromBlancher();
    g.teleport(S.broth.x, S.broth.z); g.pourBroth();
    g.teleport(S.garnish.x, S.garnish.z); g.garnish(g.order.spice);
    g.teleport(g.CUSTOMER_SLOT.x, g.CUSTOMER_SLOT.z); g.serve();
    return g.score;
  });
  expect(result).toBe(180);
});
