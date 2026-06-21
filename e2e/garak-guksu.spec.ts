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

test('serving a bowl scores via the core loop', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();

  const score = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    g.teleport(g.COOK_STATION.x, g.COOK_STATION.z); g.interact();
    g.teleport(g.CUSTOMER_SLOT.x, g.CUSTOMER_SLOT.z); g.serve();
    return g.score;
  });
  expect(score).toBe(100);
});
