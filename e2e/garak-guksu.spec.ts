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
