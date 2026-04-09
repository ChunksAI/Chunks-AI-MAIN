import { test, expect } from './fixtures';

test.describe('Smart Notes Panel', () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto('/app.html');
    await authedPage.waitForSelector('.chunks-ready', { state: 'attached', timeout: 10_000 });
    await authedPage.evaluate(() => window.showScreen?.('workspace'));
    await authedPage.waitForSelector('#screen-workspace', { state: 'visible', timeout: 5_000 });
  });

  test('notes panel container exists in workspace', async ({ authedPage }) => {
    const notesPanel = authedPage.locator('#ws-notes-panel');
    await expect(notesPanel).toBeAttached();
  });

  test('notes tab button exists and can be clicked', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await expect(notesTab).toBeVisible();
    await notesTab.click();
  });

  test('SmartNotesPanel toolbar renders after clicking Notes tab', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    // Format toolbar should be visible
    const toolbar = authedPage.locator('.snp-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });
  });

  test('SmartNotesPanel toolbar has format buttons', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    // Toolbar should have multiple buttons
    const toolbarBtns = authedPage.locator('.snp-tb-btn');
    const count = await toolbarBtns.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('notes area is contenteditable', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    const notesArea = authedPage.locator('.snp-notes-area');
    await expect(notesArea).toBeVisible({ timeout: 3_000 });

    const ce = await notesArea.getAttribute('contenteditable');
    expect(ce).toBe('true');
  });

  test('notes area shows placeholder text', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    const notesArea = authedPage.locator('.snp-notes-area');
    await expect(notesArea).toBeVisible({ timeout: 3_000 });

    const placeholder = await notesArea.getAttribute('data-placeholder');
    expect(placeholder).toContain('Start typing');
  });

  test('send to AI bar is present', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    const sendBar = authedPage.locator('.snp-send-bar');
    await expect(sendBar).toBeVisible({ timeout: 3_000 });
  });

  test('save indicator shows Saved status', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    const saveTxt = authedPage.locator('.snp-save-txt');
    await expect(saveTxt).toBeVisible({ timeout: 3_000 });
    await expect(saveTxt).toHaveText('Saved');
  });

  test('sticky strip container exists in PDF panel', async ({ authedPage }) => {
    const stickyStrip = authedPage.locator('#ws-sticky-strip');
    await expect(stickyStrip).toBeAttached();
  });

  test('sticky strip renders add button', async ({ authedPage }) => {
    // Simulate a document being loaded so the PDF panel (which hosts the sticky
    // strip) is visible. Without ws-doc-loaded the panel is hidden by CSS.
    await authedPage.evaluate(() =>
      document.getElementById('screen-workspace')?.classList.add('ws-doc-loaded')
    );
    const addBtn = authedPage.locator('.sticky-add-btn');
    await expect(addBtn).toBeVisible({ timeout: 3_000 });
  });

  test('clicking sticky add button opens a popup', async ({ authedPage }) => {
    // Simulate a document being loaded so the PDF panel is visible.
    await authedPage.evaluate(() =>
      document.getElementById('screen-workspace')?.classList.add('ws-doc-loaded')
    );
    const addBtn = authedPage.locator('.sticky-add-btn');
    await addBtn.click();

    const popup = authedPage.locator('.sticky-popup');
    await expect(popup).toBeVisible({ timeout: 2_000 });
  });

  test('notes panel switches back to chat tab', async ({ authedPage }) => {
    const notesTab = authedPage.locator('#ws-tab-notes');
    await notesTab.click();

    const chatTab = authedPage.locator('#ws-tab-chat');
    await chatTab.click();

    const chatContent = authedPage.locator('#ws-chat-content');
    await expect(chatContent).toBeVisible();
  });
});
