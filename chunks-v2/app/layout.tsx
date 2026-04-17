import type { Metadata, Viewport } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
import Providers from './Providers';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

const SITE_URL = 'https://chunks.online';
const OG_IMAGE = `${SITE_URL}/favicon-512x512.png`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Chunks AI — Study Smarter with AI',
    template: '%s | Chunks AI',
  },
  description:
    'AI-powered flashcards, study plans, visual tutor, and exam prep. Upload your textbooks and let AI help you learn faster.',
  keywords: [
    'AI study tool', 'flashcards', 'study plan', 'exam prep',
    'visual tutor', 'AI tutor', 'learn faster', 'chunks AI',
  ],
  authors: [{ name: 'Chunks AI', url: SITE_URL }],
  creator: 'Chunks AI',
  robots: { index: true, follow: true },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    other: [
      { rel: 'icon', url: '/favicon-192x192.png', sizes: '192x192' },
      { rel: 'icon', url: '/favicon-512x512.png', sizes: '512x512' },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'Chunks AI',
    title: 'Chunks AI — Study Smarter with AI',
    description:
      'AI-powered flashcards, study plans, visual tutor, and exam prep. Upload your textbooks and let AI help you learn faster.',
    url: SITE_URL,
    images: [{ url: OG_IMAGE, width: 512, height: 512, alt: 'Chunks AI logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chunks AI — Study Smarter with AI',
    description: 'AI-powered flashcards, study plans, visual tutor, and exam prep.',
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts — Fraunces display + DM Sans body */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* JSON-LD structured data — helps Google Knowledge Panel */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Chunks AI',
              url: SITE_URL,
              logo: OG_IMAGE,
              description:
                'AI-powered study tool with flashcards, study plans, visual tutor, and exam prep.',
              sameAs: [],
            }),
          }}
        />
      </head>
      <body>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
