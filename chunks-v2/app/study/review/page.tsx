'use client';

/**
 * app/study/review/page.tsx — Personalised Review Session page.
 *
 * StudyProvider is global (app/Providers.tsx), so this page reads directly
 * from the shared context.  If no review session is active when this page
 * mounts, the user is redirected back to the Reviewer tab.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudy } from '@/contexts/StudyContext';
import ReviewSession from '@/components/review/ReviewSession';

export default function ReviewPage() {
  const { state } = useStudy();
  const router = useRouter();

  // Redirect when no session is active (e.g. direct navigation or expired session)
  useEffect(() => {
    if (!state.reviewSession?.active) {
      router.replace('/study?tab=reviewer');
    }
    // Only run on mount — subsequent session changes are handled within ReviewSession
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render nothing until the redirect fires or the session confirms active
  if (!state.reviewSession) return null;

  return <ReviewSession />;
}
