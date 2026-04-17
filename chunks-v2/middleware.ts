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
