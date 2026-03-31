import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:5177' });

test('debug dev app loading', async ({ page }) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    pageErrors.push(`[PAGE ERROR] ${err.message}\n${err.stack}`);
  });
  
  await page.goto('/app.html');
  await page.waitForTimeout(3000);
  
  const screenHomeExists = await page.locator('#screen-home').count();
  const showScreenType = await page.evaluate(() => typeof (window as any).showScreen);
  const currentURL = page.url();
  
  console.error('=== DEBUG DEV RESULTS ===');
  console.error('screenHomeExists:', screenHomeExists);
  console.error('showScreenType:', showScreenType);
  console.error('currentURL:', currentURL);
  console.error('Page Errors:');
  pageErrors.forEach(e => console.error(e));
  console.error('Console Errors:');
  consoleMessages.filter(m => m.includes('[error]')).forEach(m => console.error(m));
  console.error('=== END ===');
  
  expect(true).toBeTruthy();
});
