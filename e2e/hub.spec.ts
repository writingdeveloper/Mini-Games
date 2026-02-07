import { test, expect } from '@playwright/test';

test.describe('Mini Games Hub', () => {
  test('허브 페이지가 로드된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Mini Games Hub');
  });

  test('3개의 게임 카드가 표시된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=도주 게임')).toBeVisible();
    await expect(page.locator('text=3D 서바이벌')).toBeVisible();
    await expect(page.locator('text=Sky Explorer')).toBeVisible();
  });

  test('도주 게임 카드 클릭시 게임 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.click('text=도주 게임');
    await expect(page).toHaveURL(/\/escape-game/);
  });

  test('서바이벌 게임 카드 클릭시 게임 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.click('text=3D 서바이벌');
    await expect(page).toHaveURL(/\/survival-game/);
  });

  test('비행 게임 카드 클릭시 게임 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sky Explorer');
    await expect(page).toHaveURL(/\/flight-game/);
  });
});

test.describe('게임 페이지 기본 기능', () => {
  test('도주 게임에 홈 버튼이 있다', async ({ page }) => {
    await page.goto('/escape-game');
    await expect(page.locator('text=홈으로')).toBeVisible();
  });

  test('도주 게임에 iframe이 로드된다', async ({ page }) => {
    await page.goto('/escape-game');
    const iframe = page.locator('iframe[title="도주 게임"]');
    await expect(iframe).toBeVisible();
  });

  test('홈 버튼 클릭시 허브로 돌아간다', async ({ page }) => {
    await page.goto('/escape-game');
    await page.click('text=홈으로');
    await expect(page).toHaveURL('/');
  });
});
