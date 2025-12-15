import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Settings theme integration', () => {
  test('changing primary color updates sidebar CSS variables', async ({ page }) => {
    await page.goto(`${BASE}/settings`);

    // Wait for settings to render
    await page.waitForSelector('#primary-hex');

    // Set primary color to red
    await page.fill('#primary-hex', '#ff0000');
    // Trigger input event to ensure React picks up change
    await page.evalOnSelector('#primary-hex', 'el => el.dispatchEvent(new Event("input", { bubbles: true }))');

    // Give React a moment to propagate state and update CSS vars
    await page.waitForTimeout(300);

    // Read CSS variable from documentElement
    const sidebarPrimary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-primary').trim());

    // Expect it to be HSL components that include hue 0 (red)
    expect(sidebarPrimary).toContain('0');

    // Also check alpha var exists
    const sidebarAccent50 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-accent-50').trim());
    expect(sidebarAccent50).toContain('0 100% 50% / 0.5');

    // And the sidebar button background should be applied (computed style)
    // Use the main stream button as sample
    const bg = await page.evaluate(() => {
      const btn = document.querySelector('.bg-sidebar-primary');
      if (!btn) return window.getComputedStyle(document.documentElement).getPropertyValue('--sidebar-primary');
      return window.getComputedStyle(btn).backgroundColor;
    });
    expect(bg).toBeTruthy();
  });
});
