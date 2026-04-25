import { type NextRequest, NextResponse } from 'next/server';

/**
 * middleware.ts — Edge middleware (currently a passthrough).
 *
 * Auth for protected routes (/study, /library, /exam, /flashcards, /research)
 * is enforced client-side by the <AuthGate> component (components/shared/AuthGate.tsx).
 *
 * Why not check auth here?  The app uses @supabase/supabase-js (not @supabase/ssr),
 * which stores sessions in localStorage — no auth cookie is ever written, so the
 * Edge Runtime cannot inspect it.  Any cookie-based check here would redirect every
 * authenticated user on a hard refresh.
 *
 * ⚠️  Security model — IMPORTANT for contributors
 * ─────────────────────────────────────────────────
 * Frontend route protection (this file + <AuthGate>) is UX-only.
 * It provides a polished user experience but is NOT a security boundary:
 * a determined caller can bypass it by hitting API routes directly.
 *
 * Real enforcement MUST live in the FastAPI backend (backend/):
 *  • Every paid/pro/ultra feature must verify the JWT via /api/verify-access.
 *  • Every admin/owner action must check the role server-side.
 *  • Guest-mode callers receive only the resources explicitly allowed for guests.
 *
 * Do NOT rely on `user.isGuest`, `user.tier`, or `user.isAdmin` from AuthContext
 * as a substitute for backend authorization — those values come from localStorage
 * and can be tampered with by the browser.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/study/:path*',
    '/library/:path*',
    '/exam/:path*',
    '/flashcards/:path*',
    '/research/:path*',
  ],
};
