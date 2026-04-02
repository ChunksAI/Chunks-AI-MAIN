/**
 * Shared Playwright fixtures for Chunks AI E2E tests.
 *
 * - `mockApi`   — intercepts every /api/* and backend call so tests never hit a real server.
 * - `authedPage` — a Page that also fakes a logged-in Supabase session.
 */

import { test as base, type Page } from '@playwright/test';

/* ------------------------------------------------------------------ */
/*  Reusable mock helpers                                              */
/* ------------------------------------------------------------------ */

/** Stub user returned by the fake Supabase session. */
export const MOCK_USER = {
  id: 'e2e-user-0001',
  email: 'e2e@chunks.test',
  user_metadata: { full_name: 'E2E Tester', avatar_url: '' },
  app_metadata: { provider: 'google' },
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
};

const MOCK_SESSION = {
  access_token: 'e2e-fake-access-token',
  refresh_token: 'e2e-fake-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: MOCK_USER,
};

/** Default library (empty) returned by GET /get-library. */
const EMPTY_LIBRARY = { books: [] };

/**
 * Install route-level mocks for every backend call the frontend can make.
 * The API_BASE in production is https://api.chunks.online but the frontend
 * resolves it at runtime; we intercept both relative and absolute patterns.
 */
export async function installApiMocks(page: Page) {
  // Mock /api/config — provides Supabase URL & anon key
  await page.route('**/api/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        supabase_url: 'https://fake.supabase.co',
        supabase_anon_key: 'fake-anon-key',
      }),
    }),
  );

  // Mock /get-library
  await page.route('**/get-library*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_LIBRARY),
    }),
  );

  // Mock /ping & /health
  await page.route('**/ping', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'pong' }),
  );
  await page.route('**/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );

  // Mock /generate-study-materials
  await page.route('**/generate-study-materials', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        study_plan: {
          title: 'E2E Study Plan',
          sections: [
            { title: 'Section 1', content: 'Introduction to the topic.' },
          ],
        },
      }),
    }),
  );

  // Mock /generate-flashcards
  await page.route('**/generate-flashcards', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cards: [
          { front: 'What is 2+2?', back: '4' },
          { front: 'Capital of France?', back: 'Paris' },
        ],
      }),
    }),
  );

  // Mock /upload-document
  await page.route('**/upload-document', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        document_id: 'doc-e2e-001',
        pages: 5,
        text: 'Extracted text from the uploaded document.',
      }),
    }),
  );

  // Mock /ask (chat)
  await page.route('**/ask', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: 'This is a mock AI response.' }),
    }),
  );

  // Mock /pdf/* — return a minimal valid PDF
  await page.route('**/pdf/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 minimal'),
    }),
  );

  // Mock /load-book
  await page.route('**/load-book', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }),
  );

  // Catch-all for any Supabase REST/Auth calls
  await page.route('**/supabase.co/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  );
}

/**
 * Inject guest-mode flag into sessionStorage so the app boots in guest mode.
 * Must be called BEFORE navigating to app.html.
 */
export async function injectGuestSession(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('chunks_guest_mode', '1');
    } catch {
      /* storage unavailable — ignore */
    }
  });
}

/**
 * Inject a fake Supabase session into localStorage so the app boots as
 * an authenticated user.  Must be called BEFORE navigating to app.html.
 */
export async function injectAuthSession(page: Page) {
  const origin = 'http://localhost:4173';

  // Supabase JS SDK stores session under this key
  const storageKey = 'chunks-ai-auth';
  const sessionPayload = JSON.stringify({
    currentSession: MOCK_SESSION,
    expiresAt: MOCK_SESSION.expires_at,
  });

  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage unavailable in headless — ignore */
      }
    },
    { key: storageKey, value: sessionPayload },
  );

  // Also set window._currentUser so screens can skip auth checks
  await page.addInitScript(
    (user) => {
      Object.defineProperty(window, '_currentUser', {
        get: () => ({
          id: user.id,
          email: user.email,
          name: user.user_metadata.full_name,
          avatar: user.user_metadata.avatar_url,
          plan: 'free',
          isAdmin: false,
          isOwner: false,
        }),
        configurable: true,
      });
    },
    MOCK_USER,
  );
}

/* ------------------------------------------------------------------ */
/*  Custom fixtures                                                    */
/* ------------------------------------------------------------------ */

type Fixtures = {
  /** A page with all API mocks installed (no auth). */
  mockApi: Page;
  /** A page with API mocks + fake auth session. */
  authedPage: Page;
  /** A page with API mocks + guest mode flag set in sessionStorage. */
  guestPage: Page;
};

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use) => {
    await installApiMocks(page);
    await use(page);
  },

  authedPage: async ({ page }, use) => {
    await installApiMocks(page);
    await injectAuthSession(page);
    await use(page);
  },

  guestPage: async ({ page }, use) => {
    await installApiMocks(page);
    await injectGuestSession(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
