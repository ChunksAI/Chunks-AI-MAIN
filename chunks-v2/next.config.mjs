/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      // ── All routes — security headers ────────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            // Content-Security-Policy — allows Supabase, Google OAuth, Google Fonts,
            // our own API, and the AI APIs.
            // 'unsafe-inline' on style-src is required for Next.js and KaTeX inline styles.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self + Google for OAuth popup
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              // Styles: self + Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts: Google Fonts CDN
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs + Google user avatars
              "img-src 'self' data: https: blob:",
              // Connections: self + Supabase + our backend API + AI APIs
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.chunks.online https://api.anthropic.com https://api.openai.com",
              // Frames: Google OAuth
              "frame-src https://accounts.google.com https://www.youtube.com blob:",
              // Workers: self (service worker, if added later)
              "worker-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },

      // ── Static assets — long-term caching ────────────────────────────────
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/favicon(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/apple-touch-icon(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/site.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
};

export default nextConfig;
