import { test, expect } from "@playwright/test";

test.describe("Mini Games Hub", () => {
  test("허브 페이지가 로드된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Mini Games Hub");
  });

  test("7개의 게임 카드와 플랫폼 배지가 모두 표시된다", async ({ page }) => {
    await page.goto("/");
    const cards = [
      "JELLY CATCHER", "마키마 says", "역전국수", "Dust Drifter",
      "Sky Explorer", "도주 게임", "3D 서바이벌",
    ];
    for (const name of cards) {
      await expect(page.locator(`text=${name}`).first()).toBeVisible();
    }
    // 정직한 플랫폼 신호: 터치 지원 4(뽑기·마키마·역전국수·도주) + PC 권장 3(사막·비행·서바이벌)
    await expect(page.getByText("터치 지원")).toHaveCount(4);
    await expect(page.getByText("PC 권장")).toHaveCount(3);
  });

  test("도주 게임 카드 클릭시 게임 페이지로 이동한다", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/escape-game"]').click();
    await expect(page).toHaveURL(/\/escape-game/);
  });

  test("서바이벌 게임 카드 클릭시 게임 페이지로 이동한다", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/survival-game"]').click();
    await expect(page).toHaveURL(/\/survival-game/);
  });

  test("비행 게임 카드 클릭시 게임 페이지로 이동한다", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/flight-game"]').click();
    await expect(page).toHaveURL(/\/flight-game/);
  });
});

test.describe("게임 페이지 - 서버 미설정 시 싱글 직행", () => {
  // 이 환경엔 NEXT_PUBLIC_GAME_SERVER_URL이 없다 → 모드 선택 화면을 건너뛰고 바로 싱글로 부팅.
  // 첫 방문자가 죽은 '멀티' 버튼이나 개발자용 에러 문구를 만나지 않도록 한 변경(2026-07 배치).
  test("도주 게임이 모드 선택 없이 바로 로드된다", async ({ page }) => {
    await page.goto("/escape-game");
    await expect(page.locator('iframe[title="도주 게임"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "싱글플레이어" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "멀티플레이어" })).toHaveCount(0);
  });

  test("개발자용 에러/모드선택 문구가 노출되지 않는다", async ({ page }) => {
    await page.goto("/escape-game");
    await expect(page.locator("body")).not.toContainText("서버가 설정되지 않았습니다");
    await expect(page.locator("body")).not.toContainText("플레이 모드를 선택");
  });

  test("홈으로 버튼이 메인 허브로 이동한다", async ({ page }) => {
    await page.goto("/escape-game");
    await page.click("text=홈으로");
    await expect(page).toHaveURL("/");
  });

  test("비행 게임이 로드된다", async ({ page }) => {
    await page.goto("/flight-game");
    await expect(
      page.locator('iframe[title="Sky Explorer - 3D Flight Game"]')
    ).toBeVisible();
  });

  test("서바이벌 게임이 모드 선택 없이 바로 로드된다", async ({ page }) => {
    await page.goto("/survival-game");
    await expect(page.locator('iframe[title="3D 서바이벌 게임"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "싱글플레이어" })).toHaveCount(0);
  });
});
