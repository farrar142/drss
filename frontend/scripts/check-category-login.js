const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Accept token via CLI arg or env var
  const providedToken = process.env.TOKEN || process.argv[2];
  if (providedToken) {
    console.log('Using provided token to initialize auth state');
    // Set token in localStorage for client-side code
    await context.addInitScript((token) => {
      try {
        window.localStorage.setItem('token', token);
      } catch (e) {
        // ignore
      }
    }, providedToken);
    // Also set cookie (use url to scope cookie correctly)
    try {
      await context.addCookies([{
        name: 'token',
        value: providedToken,
        url: 'http://localhost:3000',
        path: '/',
      }]);
    } catch (e) {
      console.log('Failed to add cookie (non-fatal):', e.message);
      // Retry with domain/path form if the runtime expects that
      try {
        await context.addCookies([{
          name: 'token',
          value: providedToken,
          domain: 'localhost',
          path: '/',
        }]);
      } catch (err2) {
        console.log('Retry to add cookie also failed:', err2.message);
      }
    }
  }

  const page = await context.newPage();

  const url = 'http://localhost:3000/category/1';
  console.log('Navigating to', url);
  // capture console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // show cookies that exist for the target before navigation
  try {
    const cookiesBefore = await context.cookies('http://localhost:3000');
    console.log('Cookies before navigation:', JSON.stringify(cookiesBefore, null, 2));
  } catch (e) {
    console.log('Could not list cookies before navigation:', e.message);
  }

  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Initial response status:', resp && resp.status());

  // If redirected to sign-in, attempt to fill credentials
  const path = page.url();
  console.log('Current URL after navigation:', path);

  if (path.includes('/auth/signin') || (await page.$('input[name="email"], input[name="username"], input[type="email"]'))) {
    try {
      const user = 'sandring';
      const pass = 'gksdjf452@';
      const userSel = await page.$('input[name="username"]') ? 'input[name="username"]' : (await page.$('input[name="email"]') ? 'input[name="email"]' : 'input[type="email"]');
      const passSel = (await page.$('input[name="password"]')) ? 'input[name="password"]' : 'input[type="password"]';

      console.log('Filling login fields:', userSel, passSel);
      // Try to fill using evaluate to be robust against non-visible inputs and dispatch events
      await page.evaluate(({ userSel, user }) => {
        const el = document.querySelector(userSel);
        if (el) {
          el.value = user;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { userSel, user });
      await page.evaluate(({ passSel, pass }) => {
        const el = document.querySelector(passSel);
        if (el) {
          el.value = pass;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { passSel, pass });

      // Prefer buttons labeled '로그인' or 'Login' (localized)
      // Click the login button by matching its text (fallback to DOM click to avoid locator issues)
      const clicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().includes('로그인') || (b.textContent || '').trim().includes('Login'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      if (clicked) {
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => { });
        console.log('Clicked login button (via DOM click)');
      } else {
        console.log('No button to submit login found, trying Enter key in password field');
        try {
          await page.focus(passSel).catch(() => { });
          await page.keyboard.press('Enter');
          await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => { });
          console.log('Pressed Enter in password field');
        } catch (err) {
          console.log('Enter key submit failed:', err.message);
        }
      }
    } catch (err) {
      console.error('Login attempt error:', err.message);
    }
  }

  await page.waitForTimeout(1000);
  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  const title = await page.title().catch(() => '');
  console.log('Title:', title);

  const body = await page.locator('body').innerText().catch(() => '');
  console.log('Body snippet:', body.slice(0, 500).replace(/\n/g, ' '));

  // Dump possible form controls for debugging
  const controls = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button,input[type="submit"],input[type="button"],a'));
    return nodes.map(n => ({ tag: n.tagName, text: n.textContent && n.textContent.trim().slice(0, 50), outer: (n.outerHTML || '').slice(0, 200) }));
  });
  console.log('Controls found on page (sample):', JSON.stringify(controls, null, 2));

  const shot = await page.screenshot({ fullPage: true });
  const outDir = 'tmp';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = `${outDir}/category-check-screenshot.png`;
  fs.writeFileSync(out, shot);
  console.log('Screenshot saved to', out);

  await browser.close();
})();
