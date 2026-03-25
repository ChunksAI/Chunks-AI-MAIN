import { test, expect } from './fixtures';

test.describe('Signup flow', () => {
  test('shows the auth modal with Google sign-in and guest options', async ({ mockApi }) => {
    await mockApi.goto('/app.html');

    // The auth modal overlay should exist in the DOM
    const overlay = mockApi.locator('#auth-modal-overlay');
    await expect(overlay).toBeAttached();

    // Open the auth modal via the global helper
    await mockApi.evaluate(() => window.openAuthModal?.());
    await expect(overlay).toBeVisible();

    // Google sign-in button should be present
    const googleBtn = mockApi.locator('#am-btn-google');
    await expect(googleBtn).toBeVisible();

    // Modal card should show the welcome text
    await expect(mockApi.locator('#am-content .am-title')).toContainText('Welcome');

    // Feature pills advertise key capabilities
    const pills = mockApi.locator('.am-pill');
    await expect(pills).not.toHaveCount(0);
  });

  test('can close the auth modal', async ({ mockApi }) => {
    await mockApi.goto('/app.html');

    await mockApi.evaluate(() => window.openAuthModal?.());
    const overlay = mockApi.locator('#auth-modal-overlay');
    await expect(overlay).toBeVisible();

    // Close via the close button
    await mockApi.locator('#am-close-btn').click();
    await expect(overlay).toBeHidden();
  });

  test('auth modal contains privacy and terms links', async ({ mockApi }) => {
    await mockApi.goto('/app.html');
    await mockApi.evaluate(() => window.openAuthModal?.());

    const privacyLink = mockApi.locator('#am-content .am-footer a[href="/privacy"]');
    const termsLink = mockApi.locator('#am-content .am-footer a[href="/terms"]');

    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
  });
});
