import { test, expect } from './fixtures';

test.describe('Flashcards', () => {
  test('flashcard screen renders with topic input and generate button', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await authedPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await authedPage.evaluate(() => window.showScreen?.('flash'));

    const screen = authedPage.locator('#screen-flash');
    await expect(screen).toBeVisible();

    // Home/generation area should be visible
    const genCard = authedPage.locator('.fc-gen-card');
    await expect(genCard).toBeAttached();

    // Topic input and generate button
    const topicInput = authedPage.locator('#fc-topic-input');
    await expect(topicInput).toBeAttached();

    const genBtn = authedPage.locator('#fc-gen-btn');
    await expect(genBtn).toBeAttached();
  });

  test('can enter a topic and card count for flashcard generation', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await authedPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await authedPage.evaluate(() => window.showScreen?.('flash'));

    // Fill in topic
    const topicInput = authedPage.locator('#fc-topic-input');
    await topicInput.fill('World War II key events');
    await expect(topicInput).toHaveValue('World War II key events');

    // Card count selector should be present
    const countInput = authedPage.locator('#fc-count-input');
    await expect(countInput).toBeAttached();
  });

  test('streak widget is visible on the flashcard screen', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await authedPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await authedPage.evaluate(() => window.showScreen?.('flash'));

    const streakWidget = authedPage.locator('#fc-streak-widget');
    await expect(streakWidget).toBeAttached();
  });

  test('deck grid area exists for displaying flashcard decks', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await authedPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await authedPage.evaluate(() => window.showScreen?.('flash'));

    const deckGrid = authedPage.locator('#fc-deck-grid');
    await expect(deckGrid).toBeAttached();
  });

  test('upload button exists for PDF-based flashcard generation', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 30_000 });
    await authedPage.waitForFunction(() => !!(window as any).showScreen, { timeout: 5_000 });

    await authedPage.evaluate(() => window.showScreen?.('flash'));

    const uploadBtn = authedPage.locator('#fc-upload-btn');
    await expect(uploadBtn).toBeAttached();
  });
});
