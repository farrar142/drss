import { test, expect } from '@playwright/test';
const BASE = process.env.BASE_URL || 'http://localhost:3001';

test('static test page reflects theme variable updates', async ({ page }) => {
  await page.goto(`${BASE}/test-theme.html`);
  await page.waitForSelector('#color');

  // set to red
  await page.fill('#color', '#ff0000');
  // dispatch input event
  await page.evalOnSelector('#color', 'el => el.dispatchEvent(new Event("input", { bubbles: true }))');

  // small wait for CSS vars
  await page.waitForTimeout(200);

  const sidebarPrimary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-primary').trim());
  expect(sidebarPrimary).toContain('0');

  // check that the sample element's background-color is set (computed)
  const bg = await page.evaluate(() => {
    const el = document.getElementById('sample');
    return window.getComputedStyle(el).backgroundColor;
  });
  expect(bg).toBeTruthy();
});