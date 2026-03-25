import { test, expect } from './fixtures';

test.describe('PDF Viewer', () => {
  test('workspace screen renders with PDF panel elements', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('workspace'));

    const screen = authedPage.locator('#screen-workspace');
    await expect(screen).toBeVisible();

    // PDF viewer container should exist
    const pdfView = authedPage.locator('#ws-pdf-view');
    await expect(pdfView).toBeAttached();
  });

  test('PDF viewer shows default "No book loaded" text', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('workspace'));

    const bookName = authedPage.locator('#ws-book-name');
    await expect(bookName).toBeAttached();

    const text = await bookName.textContent();
    expect(text?.toLowerCase()).toContain('no book');
  });

  test('PDF canvas wrapper exists for rendering pages', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('workspace'));

    const canvasWrap = authedPage.locator('#ws-pdf-canvas-wrap');
    await expect(canvasWrap).toBeAttached();
  });

  test('outline panel exists for table of contents', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('workspace'));

    const outlinePanel = authedPage.locator('#ws-outline-panel');
    await expect(outlinePanel).toBeAttached();
  });

  test('PDF attachment input accepts PDF files', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('workspace'));

    const pdfInput = authedPage.locator('#ws-attach-pdf');
    await expect(pdfInput).toBeAttached();

    const accept = await pdfInput.getAttribute('accept');
    expect(accept).toContain('pdf');
  });
});
