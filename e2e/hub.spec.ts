import { test, expect } from '@playwright/test';

test.describe('Mini Games Hub', () => {
  test('허브 페이지가 로드된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Mini Games Hub');
  });

  test('3개의 게임 카드가 표시된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=도주 게임').first()).toBeVisible();
    await expect(page.locator('text=3D 서바이벌').first()).toBeVisible();
    await expect(page.locator('text=Sky Explorer').first()).toBeVisible();
  });

  test('도주 게임 카드 클릭시 게임 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/escape-game"]').click();
    await expect(page).toHaveURL(/\/escape-game/);
  });

  test('서바이벌 게임 카드 클릭시 게임 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/survival-game"]').click();
    await expect(page).toHaveURL(/\/survival-game/);
  });

  test('비행 게임 카드 클릭시 게임 페이지로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/flight-game"]').click();
    await expect(page).toHaveURL(/\/flight-game/);
  });
});

test.describe('게임 페이지 - 모드 선택', () => {
  test('도주 게임에 모드 선택 화면이 표시된다', async ({ page }) => {
    await page.goto('/escape-game');
    await expect(page.locator('text=싱글플레이어')).toBeVisible();
    await expect(page.locator('text=멀티플레이어')).toBeVisible();
    await expect(page.locator('text=홈으로')).toBeVisible();
  });

  test('싱글플레이어 선택시 게임이 로드된다', async ({ page }) => {
    await page.goto('/escape-game');
    await page.click('text=싱글플레이어');
    const iframe = page.locator('iframe[title="도주 게임"]');
    await expect(iframe).toBeVisible();
  });

  test('게임 중 모드 선택으로 돌아갈 수 있다', async ({ page }) => {
    await page.goto('/escape-game');
    await page.click('text=싱글플레이어');
    await page.click('text=모드 선택');
    await expect(page.locator('text=싱글플레이어')).toBeVisible();
  });

  test('홈으로 버튼이 메인 허브로 이동한다', async ({ page }) => {
    await page.goto('/escape-game');
    await page.click('text=홈으로');
    await expect(page).toHaveURL('/');
  });

  test('비행 게임에 모드 선택 화면이 표시된다', async ({ page }) => {
    await page.goto('/flight-game');
    await expect(page.locator('text=Sky Explorer')).toBeVisible();
    await expect(page.locator('text=싱글플레이어')).toBeVisible();
  });

  test('서바이벌 게임에 모드 선택 화면이 표시된다', async ({ page }) => {
    await page.goto('/survival-game');
    await expect(page.locator('text=3D 서바이벌')).toBeVisible();
    await expect(page.locator('text=싱글플레이어')).toBeVisible();
  });
});
