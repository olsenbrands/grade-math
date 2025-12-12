'use client';

import { useEffect } from 'react';
import { ErrorBoundaryFallback } from '@/components/ui/error-state';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return <ErrorBoundaryFallback error={error} reset={reset} />;
}
