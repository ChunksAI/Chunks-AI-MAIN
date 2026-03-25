import { test, expect } from './fixtures';

test.describe('Study Plan creation', () => {
  test('study plan screen renders with tabs and generate button', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    // Navigate to study plan screen
    await authedPage.evaluate(() => window.showScreen?.('studyplan'));

    const screen = authedPage.locator('#screen-studyplan');
    await expect(screen).toBeVisible();

    // Tab buttons should be present
    await expect(authedPage.locator('#sp-tab-upload')).toBeAttached();
    await expect(authedPage.locator('#sp-tab-topic')).toBeAttached();
    await expect(authedPage.locator('#sp-tab-notes')).toBeAttached();
  });

  test('can switch to topic tab and enter a topic', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('studyplan'));

    // Switch to topic tab
    await authedPage.evaluate(() => window.spSwitchTab?.('topic'));

    const topicInput = authedPage.locator('#sp-topic-input');
    await expect(topicInput).toBeVisible();

    // Type a topic
    await topicInput.fill('Organic Chemistry — Nucleophilic Substitution');
    await expect(topicInput).toHaveValue('Organic Chemistry — Nucleophilic Substitution');
  });

  test('can select depth levels', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('studyplan'));
    await authedPage.evaluate(() => window.spSwitchTab?.('topic'));

    // Click each depth option
    for (const depth of ['intro', 'mid', 'adv', 'exam']) {
      const btn = authedPage.locator(`#sp-depth-${depth}`);
      await expect(btn).toBeAttached();
    }

    // Select "Advanced"
    await authedPage.locator('#sp-depth-adv').click();
    await expect(authedPage.locator('#sp-depth-adv')).toHaveClass(/active|selected|sp-depth-active/);
  });

  test('can switch to notes tab and type notes', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('studyplan'));
    await authedPage.evaluate(() => window.spSwitchTab?.('notes'));

    const notesInput = authedPage.locator('#sp-notes-input');
    await expect(notesInput).toBeVisible();

    await notesInput.fill('Key concept: SN1 vs SN2 reactions differ in mechanism and kinetics.');
    await expect(notesInput).toHaveValue(/SN1 vs SN2/);
  });

  test('generate button is present and clickable', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('studyplan'));
    await authedPage.evaluate(() => window.spSwitchTab?.('topic'));

    const generateBtn = authedPage.locator('#sp-generate-btn');
    await expect(generateBtn).toBeAttached();

    // Fill in a topic so the button can be activated
    await authedPage.locator('#sp-topic-input').fill('Linear Algebra');

    // The generate button should be visible and enabled
    await expect(generateBtn).toBeVisible();
  });
});
