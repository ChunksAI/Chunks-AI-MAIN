import { test, expect } from './fixtures';

test('debug: check what is and is not in DOM', async ({ mockApi }) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  
  mockApi.on('console', msg => {
    if (msg.type() === 'error') consoleMessages.push(`CONSOLE ERROR: ${msg.text()}`);
  });
  mockApi.on('pageerror', err => {
    pageErrors.push(`PAGE ERROR: ${err.message}`);
  });

  await mockApi.goto('/app.html');
  await mockApi.waitForTimeout(3000);
  
  const result = await mockApi.evaluate(() => {
    return {
      authModal: !!document.getElementById('auth-modal-overlay'),
      screenHome: !!document.getElementById('screen-home'),
      screenWorkspace: !!document.getElementById('screen-workspace'),
      screenFlash: !!document.getElementById('screen-flash'),
      screenStudyplan: !!document.getElementById('screen-studyplan'),
      chunksReady: document.body.classList.contains('chunks-ready'),
      showScreen: typeof (window as any).showScreen,
      spSwitchTab: typeof (window as any).spSwitchTab,
      openAuthModal: typeof (window as any).openAuthModal,
    };
  });
  
  console.log('DOM state:', JSON.stringify(result, null, 2));
  console.log('Console errors:', consoleMessages.slice(0, 5));
  console.log('Page errors:', pageErrors.slice(0, 5));
  
  expect(false).toBe(true);
});
