import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions that govern your use of Chunks AI.',
};

const LAST_UPDATED = 'April 10, 2026';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        {/* Header */}
        <header className="legal-header">
          <Link href="/" className="legal-logo">
            <div className="logo-mark" style={{ width: 32, height: 32 }}>
              <svg viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.6" />
                <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.6" />
                <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.3" />
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
              Chunks
            </span>
          </Link>
          <nav className="legal-nav">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/study">Open App</Link>
          </nav>
        </header>

        {/* Document */}
        <main className="legal-doc">
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

          <p className="legal-intro">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of{' '}
            <strong>Chunks AI</strong> and its related services (collectively, the
            &ldquo;Service&rdquo;). By accessing or using the Service you agree to be bound by
            these Terms. If you do not agree, do not use the Service.
          </p>

          <section className="legal-section">
            <h2>1. Who May Use the Service</h2>
            <p>
              You must be at least 13 years old (or the applicable age of digital consent in your
              jurisdiction) to use Chunks AI. By using the Service you represent that you meet this
              requirement. If you are accessing the Service on behalf of an organisation, you
              represent that you have authority to bind that organisation to these Terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Your Account</h2>
            <ul>
              <li>
                You are responsible for maintaining the confidentiality of your account credentials
                and for all activities that occur under your account.
              </li>
              <li>
                You must provide accurate and complete registration information and keep it up to
                date.
              </li>
              <li>
                You must notify us immediately at{' '}
                <a href="mailto:support@chunks.online">support@chunks.online</a> if you suspect
                unauthorised access to your account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these Terms.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Subscription Plans and Billing</h2>
            <p>
              Chunks AI offers a free tier and paid subscription plans (Pro, Ultra, Team). Paid
              plans are billed in advance on a monthly or annual basis. By subscribing you authorise
              us to charge the payment method on file.
            </p>
            <ul>
              <li>
                <strong>Cancellation</strong> — you may cancel your subscription at any time.
                Cancellation takes effect at the end of the current billing period. We do not
                provide refunds for partial periods except where required by law.
              </li>
              <li>
                <strong>Price changes</strong> — we may change subscription prices with 30 days&apos;
                notice. Your continued use after the notice period constitutes acceptance.
              </li>
              <li>
                <strong>Free trial</strong> — if we offer a free trial, we will notify you before
                any charges begin.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
              <li>
                Upload or share content that infringes intellectual property rights, is defamatory,
                obscene, harmful, or otherwise objectionable.
              </li>
              <li>
                Attempt to probe, scan, or test the vulnerability of any Chunks AI system, or
                circumvent any security or authentication measures.
              </li>
              <li>
                Use the Service to generate, train, or compile data for a competing product
                without our written consent.
              </li>
              <li>
                Use automated tools (bots, scrapers) to access the Service in a way that places
                an unreasonable load on our infrastructure.
              </li>
              <li>
                Impersonate any person or entity or misrepresent your affiliation with any person
                or entity.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Intellectual Property</h2>
            <h3>Our IP</h3>
            <p>
              The Chunks AI platform, including its software, design, trademarks, and content
              (excluding your own uploaded content), is owned by Chunks AI and protected by
              applicable intellectual property laws.
            </p>
            <h3>Your content</h3>
            <p>
              You retain ownership of any content you upload (documents, notes, etc.). By uploading
              content you grant us a limited, non-exclusive, royalty-free licence to process and
              display that content solely to provide the Service to you.
            </p>
            <h3>AI-generated outputs</h3>
            <p>
              Subject to these Terms and applicable law, you own the AI-generated outputs you
              receive through the Service. You are responsible for how you use those outputs.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Third-Party Services</h2>
            <p>
              The Service uses third-party AI APIs to generate responses. We do not warrant the
              accuracy, completeness, or fitness for purpose of any AI-generated content. You should
              not rely on AI-generated content as a substitute for professional advice (medical,
              legal, financial, etc.).
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
              ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHUNKS AI SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR
              USE OF OR INABILITY TO USE THE SERVICE. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM
              ARISING FROM THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US
              IN THE 12 MONTHS PRECEDING THE CLAIM OR (B) USD $50.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Chunks AI and its officers, directors,
              employees, and agents from any claims, damages, losses, or expenses (including
              reasonable legal fees) arising from your violation of these Terms or your use of the
              Service.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Termination</h2>
            <p>
              We may terminate or suspend your account at any time for violation of these Terms,
              with or without notice. You may terminate your account at any time via Settings →
              Account → Delete account. Sections 5, 7, 8, and 9 survive termination.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Changes to the Service and Terms</h2>
            <p>
              We may modify the Service or these Terms at any time. We will provide reasonable
              notice of material changes (e.g., via email or in-app notification). Your continued
              use of the Service after the effective date constitutes acceptance.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction in which Chunks AI is
              registered, without regard to conflict of law principles. Any disputes shall be
              resolved by binding arbitration or, where arbitration is not available, in the courts
              of that jurisdiction.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. Contact</h2>
            <p>For questions about these Terms, please contact:</p>
            <div className="legal-contact">
              <strong>Chunks AI</strong>
              <br />
              Email:{' '}
              <a href="mailto:legal@chunks.online">legal@chunks.online</a>
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
