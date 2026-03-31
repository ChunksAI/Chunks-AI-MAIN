import { test, expect } from './fixtures';

test('debug app loading', async ({ mockApi }) => {
  const pageErrors: string[] = [];
  
  mockApi.on('pageerror', err => {
    pageErrors.push(`${err.message}:::${err.stack || ''}`);
  });
  
  await mockApi.goto('/app.html');
  await mockApi.waitForTimeout(3000);
  
  const screenHomeCount = await mockApi.locator('#screen-home').count();
  const showScreenType = await mockApi.evaluate(() => typeof (window as any).showScreen);
  
  console.error(`RESULTS: home=${screenHomeCount} showScreen=${showScreenType}`);
  console.error(`PAGE_ERRORS: ${pageErrors.join(' ||| ')}`);
  
  expect(true).toBeTruthy();
});
