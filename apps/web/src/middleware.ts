import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// The health check stays public (used by uptime/orchestration checks that don't carry a Clerk
// session); everything else requires sign-in. See plan/PHASE_3_PLAN.md section 4.2.
const isPublicRoute = createRouteMatcher(['/api/health']);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
