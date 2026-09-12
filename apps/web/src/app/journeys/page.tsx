import { Suspense } from 'react';
import JourneysClient from './journeys-client';

export default function JourneysPage() {
  // JourneysClient (via LiveRunTracker) reads the ?runId= query param with useSearchParams(),
  // which requires a Suspense boundary in the App Router — otherwise the whole page opts out of
  // static rendering entirely instead of just the part that needs the search params.
  return (
    <Suspense fallback={null}>
      <JourneysClient />
    </Suspense>
  );
}
