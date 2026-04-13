import type { Metadata } from 'next';
import Link from 'next/link';
import ChunksLogo from '@/components/shared/ChunksLogo';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Chunks AI collects, uses, and protects your personal data.',
};

const LAST_UPDATED = 'April 10, 2026';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        {/* Header */}
        <header className="legal-header">
          <Link href="/" className="legal-logo">
            <div className="logo-mark" style={{ width: 32, height: 32 }}>
              <ChunksLogo size={32} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
              Chunks
            </span>
          </Link>
          <nav className="legal-nav">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/study">Open App</Link>
          </nav>
        </header>

        {/* Document */}
        <main className="legal-doc">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

          <p className="legal-intro">
            Welcome to <strong>Chunks AI</strong> (&ldquo;Chunks,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;). We are committed to protecting your personal
            information and your right to privacy. This Privacy Policy explains how we collect, use,
            disclose, and safeguard your information when you use our platform.
          </p>

          <section className="legal-section">
            <h2>1. Information We Collect</h2>
            <h3>Information you provide directly</h3>
            <ul>
              <li>
                <strong>Account information</strong> — email address, display name, and profile
                photo (if you sign in with Google).
              </li>
              <li>
                <strong>Documents you upload</strong> — textbooks, notes, and study materials you
                share with the platform for processing.
              </li>
              <li>
                <strong>Messages</strong> — your chat messages and interactions with the AI tutor.
              </li>
              <li>
                <strong>Payment information</strong> — if you subscribe to a paid plan, payment is
                processed by our third-party payment processor (Stripe). We do not store your card
                details.
              </li>
            </ul>
            <h3>Information collected automatically</h3>
            <ul>
              <li>
                <strong>Usage data</strong> — pages visited, features used, session duration, and
                interaction patterns (only if you opt in to data sharing).
              </li>
              <li>
                <strong>Device data</strong> — browser type, operating system, and IP address for
                security and analytics.
              </li>
              <li>
                <strong>Cookies and local storage</strong> — we use browser storage to remember
                your preferences, session state, and recently visited textbooks.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To provide, operate, and improve the Chunks AI platform.</li>
              <li>To personalise your study experience (AI responses, recommendations).</li>
              <li>To process payments and manage your subscription.</li>
              <li>To send important account notifications (billing, security alerts).</li>
              <li>To send optional product updates and study reminders (you can unsubscribe anytime).</li>
              <li>To analyse aggregated, anonymised usage trends to improve the product.</li>
              <li>To detect and prevent fraud, abuse, and security incidents.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. How We Share Your Information</h2>
            <p>We do not sell your personal data. We may share information with:</p>
            <ul>
              <li>
                <strong>AI providers</strong> — your messages and document content are sent to
                third-party AI APIs (e.g., Anthropic, OpenAI) to generate responses. These providers
                are bound by their own privacy policies and data processing agreements.
              </li>
              <li>
                <strong>Infrastructure providers</strong> — hosting, database, file storage, and CDN
                services (e.g., Supabase, Vercel, AWS).
              </li>
              <li>
                <strong>Analytics</strong> — aggregated, anonymised usage data may be shared with
                analytics providers.
              </li>
              <li>
                <strong>Legal requirements</strong> — we may disclose information if required by law
                or to protect the rights and safety of users.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Chat history is
              stored according to your settings (you can delete it anytime in
              Settings → Data controls). Uploaded documents are retained until you delete them.
              You can request deletion of your account and all associated data by contacting{' '}
              <a href="mailto:privacy@chunks.online">privacy@chunks.online</a>.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Cookies and Tracking</h2>
            <p>We use the following types of browser storage:</p>
            <ul>
              <li>
                <strong>Essential</strong> — session tokens (authentication), CSRF tokens. Required
                for the app to function.
              </li>
              <li>
                <strong>Preference</strong> — language, theme, font size, and other settings stored
                in localStorage.
              </li>
              <li>
                <strong>Analytics (opt-in)</strong> — usage events sent to our analytics provider
                only if you enable &ldquo;Use data to improve Chunks AI&rdquo; in Settings.
              </li>
            </ul>
            <p>You can clear local storage at any time via your browser settings or via Settings → Data controls in the app.</p>
          </section>

          <section className="legal-section">
            <h2>6. Security</h2>
            <p>
              We implement industry-standard security measures including encrypted connections
              (HTTPS/TLS), JWT-based authentication, and server-side rate limiting. However, no
              method of transmission over the internet is 100% secure, and we cannot guarantee
              absolute security.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Children&apos;s Privacy</h2>
            <p>
              Chunks AI is not directed at children under 13 (or the applicable age of digital
              consent in your jurisdiction). We do not knowingly collect personal data from children.
              If you believe a child has provided us with personal data, please contact us at{' '}
              <a href="mailto:privacy@chunks.online">privacy@chunks.online</a>.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;).</li>
              <li>Object to or restrict certain processing.</li>
              <li>Data portability (receive your data in a machine-readable format).</li>
              <li>Withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{' '}
              <a href="mailto:privacy@chunks.online">privacy@chunks.online</a>.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. International Transfers</h2>
            <p>
              Your data may be processed in countries other than your own. We ensure adequate
              safeguards are in place (e.g., Standard Contractual Clauses) when transferring data
              outside the EEA or other applicable regions.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes via email or an in-app notification. Your continued use of Chunks AI after the
              effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data, please
              contact us:
            </p>
            <div className="legal-contact">
              <strong>Chunks AI</strong>
              <br />
              Email:{' '}
              <a href="mailto:privacy@chunks.online">privacy@chunks.online</a>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="legal-footer">
          <div className="legal-footer-links">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/study">Open App</Link>
          </div>
          <p className="legal-copyright">© {new Date().getFullYear()} Chunks AI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
