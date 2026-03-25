import { test, expect } from './fixtures';
import path from 'path';
import fs from 'fs';

/* Create a tiny valid PDF in /tmp so we can use it for upload tests. */
const TMP_PDF = '/tmp/e2e-test-upload.pdf';

test.beforeAll(() => {
  // Minimal valid PDF (1-page blank)
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
  fs.writeFileSync(TMP_PDF, pdfContent);
});

test.describe('Chunk / Document upload', () => {
  test('study plan upload tab has a file input that accepts PDF', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    // Navigate to study plan screen (upload is the default tab)
    await authedPage.evaluate(() => window.showScreen?.('studyplan'));
    await authedPage.evaluate(() => window.spSwitchTab?.('upload'));

    const fileInput = authedPage.locator('#sp-file-input');
    await expect(fileInput).toBeAttached();

    // The input should accept PDF files
    const accept = await fileInput.getAttribute('accept');
    expect(accept).toContain('pdf');
  });

  test('can attach a PDF file via the study plan upload zone', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('studyplan'));
    await authedPage.evaluate(() => window.spSwitchTab?.('upload'));

    const fileInput = authedPage.locator('#sp-file-input');
    await fileInput.setInputFiles(TMP_PDF);

    // After attaching, the file name display should update
    // (the idle upload zone hides and the attached state shows)
    const attached = authedPage.locator('#sp-upload-attached');
    // Give time for the file-processing callback
    await authedPage.waitForTimeout(500);
    // Either the attached element is visible or the file-name element has text
    const fileName = authedPage.locator('#sp-file-name');
    const hasText = await fileName.textContent().catch(() => '');
    expect(hasText.length > 0 || (await attached.isVisible().catch(() => false))).toBeTruthy();
  });

  test('workspace screen has a PDF attachment input', async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });

    await authedPage.evaluate(() => window.showScreen?.('workspace'));

    const wsFileInput = authedPage.locator('#ws-attach-pdf');
    await expect(wsFileInput).toBeAttached();
  });
});
