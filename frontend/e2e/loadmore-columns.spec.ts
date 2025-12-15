import { test, expect } from '@playwright/test';

test('load more triggers when columns uneven', async ({ page }) => {
  await page.goto('http://localhost:3000/test/loadmore');

  // Ensure page loaded and initial count is 0
  await expect(page.locator('#load-count')).toHaveText('0');

  // Scroll to bottom repeatedly until loadCount increments
  const maxAttempts = 8;
  for (let i = 0; i < maxAttempts; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // wait a short time for intersection observers to trigger
    await page.waitForTimeout(500);
    const text = await page.locator('#load-count').innerText();
    if (text !== '0') break;
  }

  const final = await page.locator('#load-count').innerText();
  expect(Number(final)).toBeGreaterThan(0);
});
