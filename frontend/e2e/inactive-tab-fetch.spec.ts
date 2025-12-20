import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Inactive tab should not fetch data continuously', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.fill('#username', 'test');
    await page.fill('#password', 'test1234');
    await page.click('button[type="submit"]');
    
    // 홈 페이지로 리다이렉트 대기
    await page.waitForURL('**/home', { timeout: 10000 });
  });

  test('home tab should not fetch when another tab is active on page reload', async ({ page }) => {
    // API 호출 카운트
    let homeApiCallCount = 0;
    
    // 홈 탭이 데이터 로드 완료될 때까지 대기
    await page.waitForSelector('[class*="glass-card"]', { timeout: 10000 });
    
    // 카테고리 사이드바에서 첫 번째 카테고리 클릭하여 새 탭 열기
    const categoryItem = page.locator('[class*="category-item"], [class*="CategoryDrawer"] button, [class*="drawer"] [role="button"]').first();
    
    // 카테고리가 없으면 피드 아이템 클릭 (다른 방법으로 새 탭 생성)
    if (await categoryItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryItem.click();
    } else {
      // 사이드바의 첫 번째 클릭 가능한 요소 찾기
      const sidebarItem = page.locator('aside button, aside [role="button"], [class*="Drawer"] button').first();
      if (await sidebarItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sidebarItem.click();
      }
    }
    
    // 새 탭이 열릴 때까지 대기
    await page.waitForTimeout(1000);
    
    // 페이지 리로드 전 API 모니터링 설정
    await page.route('**/api/rss/items**', async (route) => {
      homeApiCallCount++;
      console.log(`Home API call #${homeApiCallCount}`);
      await route.continue();
    });
    
    // 페이지 리로드
    await page.reload();
    
    // 리로드 후 충분한 시간 대기 (버그가 있으면 여러 번 호출됨)
    await page.waitForTimeout(5000);
    
    // 비활성 탭(홈)에서는 API가 호출되지 않아야 함
    // 만약 버그가 있으면 hasNext가 false가 될 때까지 계속 호출됨
    console.log(`Total home API calls: ${homeApiCallCount}`);
    
    // 비활성 탭이므로 API 호출이 없거나 최소한이어야 함
    // (초기 로드 1회는 허용할 수 있지만, 연속 호출은 버그)
    // 활성 탭의 API 호출만 있어야 함
    expect(homeApiCallCount).toBeLessThanOrEqual(2);
  });

  test('home tab should fetch data when it becomes active', async ({ page }) => {
    // 홈 탭이 활성화되어 있을 때 데이터가 로드되어야 함
    await page.waitForSelector('[class*="glass-card"]', { timeout: 10000 });
    
    // 피드 아이템이 표시되어야 함
    const items = page.locator('[class*="glass-card"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('switching tabs should properly control data fetching', async ({ page }) => {
    let apiCallCount = 0;
    
    // API 모니터링
    await page.route('**/api/rss/items**', async (route) => {
      apiCallCount++;
      await route.continue();
    });
    
    // 홈 탭 데이터 로드 대기
    await page.waitForSelector('[class*="glass-card"]', { timeout: 10000 });
    
    const initialCallCount = apiCallCount;
    
    // 카테고리 사이드바에서 카테고리 클릭하여 새 탭 열기
    const categoryItem = page.locator('[data-testid="category-item"], .category-item').first();
    if (await categoryItem.isVisible()) {
      await categoryItem.click();
      await page.waitForTimeout(2000);
    }
    
    // 새 탭이 열리면 해당 탭의 API 호출이 발생
    // 홈 탭은 비활성화되어 추가 API 호출이 없어야 함
    
    // 다시 홈 탭 클릭
    const homeTab = page.locator('[data-testid="home-tab"], [role="tab"]:has-text("메인스트림"), [role="tab"]:has-text("Home")').first();
    if (await homeTab.isVisible()) {
      // 현재 호출 수 기록
      const beforeHomeClick = apiCallCount;
      await homeTab.click();
      await page.waitForTimeout(1000);
      
      // 홈 탭이 이미 데이터를 가지고 있으므로 추가 호출이 없어야 함
      // (또는 최소한의 호출만)
      const afterHomeClick = apiCallCount;
      expect(afterHomeClick - beforeHomeClick).toBeLessThanOrEqual(1);
    }
  });
});
