'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ExamProvider, useExam } from '@/contexts/ExamContext';
import { StudyProvider } from '@/contexts/StudyContext';
import Sidebar from '@/components/study/layout/Sidebar';
import ExamSetup from '@/components/exam/ExamSetup';
import ExamRunner from '@/components/exam/ExamRunner';
import ExamResults from '@/components/exam/ExamResults';
import AuthGate from '@/components/shared/AuthGate';

// ─── Inner layout — has access to ExamContext ─────────────────────────────────

function ExamLayout() {
  const { state } = useExam();
  const { user } = useAuth();
  const router = useRouter();

  const { phase } = state;

  // Full-screen takeover during running phase — hide the app shell entirely
  if (phase === 'running') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        <ExamRunner />
      </div>
    );
  }

  // Setup and results share the normal app shell (sidebar + main content area)
  return (
    <div className="app-shell">
      <Sidebar
        activeNav="exam"
        onNavChange={(id) => {
          if (id === 'study') router.push('/study');
          else if (id === 'library') router.push('/library');
        }}
        onNewSession={() => router.push('/study')}
      />

      <main className="main" style={{ overflowY: 'auto' }}>
        {phase === 'setup' && <ExamSetup />}
        {phase === 'results' && <ExamResults />}
      </main>
    </div>
  );
}

// ─── Page — wraps with providers ─────────────────────────────────────────────

export default function ExamPage() {
  return (
    // StudyProvider gives ExamSetup access to state.slides / docTitle
    <AuthGate>
      <StudyProvider>
        <ExamProvider>
          <ExamLayout />
        </ExamProvider>
      </StudyProvider>
    </AuthGate>
  );
}
