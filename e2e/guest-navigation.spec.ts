import { test, expect } from './fixtures';

/**
 * Guest navigation tests.
 *
 * Verifies that all sidebar screens are navigable in guest mode and that
 * the non-blocking preview banner appears on first visit to each screen.
 * Navigation must never be blocked — only actions (send message, generate
 * plan, etc.) are gated via guestGate() at the feature level.
 */

const NAVIGABLE_SCREENS = [
  'workspace',
  'library',
  'flash',
  'studyplan',
  'visual',
  'research',
  'exam',
] as const;

test.describe('Guest mode navigation', () => {
  test('all sidebar screens are in the DOM in guest mode', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });

    for (const screen of NAVIGABLE_SCREENS) {
      const screenEl = guestPage.locator(`#screen-${screen}`);
      await expect(screenEl).toBeAttached({ timeout: 5_000 });
    }
  });

  test('guest can navigate to workspace screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('workspace'));

    const screen = guestPage.locator('#screen-workspace');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('guest can navigate to library screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('library'));

    const screen = guestPage.locator('#screen-library');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('guest can navigate to flashcards screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('flash'));

    const screen = guestPage.locator('#screen-flash');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('guest can navigate to study plan screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('studyplan'));

    const screen = guestPage.locator('#screen-studyplan');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('guest can navigate to visual tutor screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('visual'));

    const screen = guestPage.locator('#screen-visual');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('guest can navigate to research screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('research'));

    const screen = guestPage.locator('#screen-research');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('guest can navigate to exam screen', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('exam'));

    const screen = guestPage.locator('#screen-exam');
    await expect(screen).toBeVisible({ timeout: 15_000 });
  });

  test('showScreen never falls back to home for guest navigating to workspace', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('workspace'));

    // The workspace screen must be active — home must NOT be active
    const homeScreen = guestPage.locator('#screen-home');
    const workspaceScreen = guestPage.locator('#screen-workspace');

    await expect(workspaceScreen).toHaveClass(/active/, { timeout: 5_000 });
    await expect(homeScreen).not.toHaveClass(/active/);
  });

  test('guest preview banner appears on first navigation to a screen with a limit', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });

    // Navigate to workspace — should trigger the guest preview banner
    await guestPage.evaluate(() => window.showScreen?.('workspace'));

    const banner = guestPage.locator('#guest-screen-preview-banner');
    await expect(banner).toBeVisible({ timeout: 3_000 });
  });

  test('guest preview banner can be dismissed', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('workspace'));

    const banner = guestPage.locator('#guest-screen-preview-banner');
    await expect(banner).toBeVisible({ timeout: 3_000 });

    // Click the close button
    await banner.locator('.gp-close').click();
    await expect(banner).not.toBeAttached({ timeout: 2_000 });
  });

  test('guest preview banner does not appear again for the same screen in the same session', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });

    // First visit — banner should appear
    await guestPage.evaluate(() => window.showScreen?.('workspace'));
    const banner = guestPage.locator('#guest-screen-preview-banner');
    await expect(banner).toBeVisible({ timeout: 3_000 });

    // Dismiss the banner
    await banner.locator('.gp-close').click();
    await expect(banner).not.toBeAttached();

    // Navigate away and back — banner should NOT appear again this session
    await guestPage.evaluate(() => window.showScreen?.('home'));
    await guestPage.evaluate(() => window.showScreen?.('workspace'));

    // Give a short window for the banner to potentially appear
    await guestPage.waitForTimeout(300);
    await expect(guestPage.locator('#guest-screen-preview-banner')).not.toBeAttached();
  });

  test('guestGate still fires when guest tries to send a message in workspace', async ({ guestPage }) => {
    await guestPage.goto('/app.html');
    await guestPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await guestPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await guestPage.evaluate(() => window.showScreen?.('workspace'));
    await guestPage.locator('#screen-workspace').waitFor({ state: 'visible' });

    // Simulate exhausting the workspace guest limit then calling guestGate.
    // Record usage well above the workspace limit (5) to guarantee the wall fires.
    const USAGE_LIMIT_THRESHOLD = 10;
    const wallShown = await guestPage.evaluate((threshold) => {
      for (let i = 0; i < threshold; i++) {
        window.guestRecordUsage?.('workspace');
      }
      // guestGate should now return false (blocked) and show login wall
      const allowed = window.guestGate?.('workspace');
      return allowed === false;
    }, USAGE_LIMIT_THRESHOLD);

    expect(wallShown).toBe(true);

    // The login wall overlay should now be visible
    const loginWall = guestPage.locator('#guest-login-wall');
    await expect(loginWall).toBeVisible({ timeout: 2_000 });
  });
});
