const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = process.env.BASE_URL || 'http://localhost:3001/settings';
  try {
    console.log('Waiting for', url);
    // Mock authentication: set a token in localStorage and intercept /api/auth/me
    await page.addInitScript(() => {
      localStorage.setItem('token', 'test-token');
    });
    await page.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'e2e', email: 'e2e@example.com' }),
      });
    });
    // Try navigating multiple times to allow dev server to come up
    let attempts = 0;
    while (attempts < 30) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 5000 });
        break;
      } catch (err) {
        attempts++;
        process.stdout.write('.');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    console.log('\nNavigated to', url);
    // Dump some body text to help debugging
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    const bodyText = await page.evaluate(() => document.body.innerText ? document.body.innerText.slice(0, 2000) : '');
    console.log('PAGE TEXT PREVIEW:\n', bodyText);
    const html = await page.content();
    console.log('PAGE HTML PREVIEW (first 1000 chars):\n', html.slice(0, 1000));
    // Wait for page content (try multiple expected phrases)
    const found = await page.$('text=주요 색상') || await page.$('text=Primary') || await page.$('text=설정');
    if (!found) {
      throw new Error('Settings page content not found; page may be redirected to login or another page');
    }

    // Use color input and hex input to change primary
    await page.fill('#primary-hex', '#ff0000');
    await page.evalOnSelector('#primary-hex', 'el => el.dispatchEvent(new Event("input", { bubbles: true }))');

    // Wait a moment
    await page.waitForTimeout(300);

    const sidebarPrimary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-primary').trim());
    const sidebarAccent50 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-accent-50').trim());

    console.log('--sidebar-primary:', sidebarPrimary);
    console.log('--sidebar-accent-50:', sidebarAccent50);

    if (!sidebarPrimary.includes('0') || !sidebarAccent50.includes('/ 0.5')) {
      console.error('Theme variables not updated as expected');
      await browser.close();
      process.exit(1);
    }

    console.log('Theme variables updated successfully');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Error during browser check:', e);
    try { await browser.close(); } catch { };
    process.exit(1);
  }
})();
