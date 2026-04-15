import { type NextRequest, NextResponse } from 'next/server';

/**
 * middleware.ts — Route guards for authenticated and guest-accessible pages.
 *
 * Protected routes: /study, /library, /exam, /flashcards, /research
 * If the user has no Supabase session cookie AND no guest session,
 * they are redirected to /login?next=<original-pathname>.
 *
 * Guest mode: If sessionStorage has 'chunks_guest_mode=1', the user is allowed
 * through. Because middleware runs on the server (Edge Runtime) it cannot access
 * sessionStorage directly. We use a dedicated cookie `chunks_guest` which the
 * client sets when entering guest mode (see AuthContext.tsx enterGuestMode).
 */

const PROTECTED_PATHS = ['/study', '/library', '/exam', '/flashcards', '/research'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply guard to the listed protected routes
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!isProtected) return NextResponse.next();

  // Check for a Supabase auth session cookie (set by @supabase/ssr)
  const supabaseSession =
    request.cookies.get('sb-access-token') ??
    request.cookies.get('sb-refresh-token') ??
    // Supabase v2 SSR cookie name pattern
    [...request.cookies.getAll()].find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

  if (supabaseSession) return NextResponse.next();

  // Check for guest mode cookie (set by AuthContext.enterGuestMode)
  const guestCookie = request.cookies.get('chunks_guest');
  if (guestCookie?.value === '1') return NextResponse.next();

  // No session — redirect to /login with next= so the user is returned here after sign-in
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  const redirectResponse = NextResponse.redirect(loginUrl);
  // Prevent browsers/CDNs from caching this redirect so re-authentication
  // always produces a fresh middleware check instead of a stale redirect loop.
  redirectResponse.headers.set('Cache-Control', 'no-store');
  return redirectResponse;
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
