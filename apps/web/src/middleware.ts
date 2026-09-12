import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// The health check, Clerk's own sign-in/sign-up pages, and the create-organization page stay
// public to auth.protect() (a protected sign-in page can never be reached — protecting it
// causes an infinite auth.protect() -> redirect-to-sign-in -> auth.protect() loop,
// ERR_TOO_MANY_REDIRECTS); everything else requires sign-in. See plan/PHASE_3_PLAN.md
// section 4.2.
//
// NOTE: Clerk's SDK flags createRouteMatcher()/auth.protect() as deprecated in favor of
// resource-based auth checks (calling auth()/auth.protect() directly in each route/page instead
// of centralizing in middleware, since middleware path-matching can diverge from how Next.js
// actually routes a request). apps/web/src/lib/workspace-auth.ts's requireWorkspace() already
// does this for the /api/websites routes — this middleware layer is kept as defense-in-depth for
// now (it still works, just isn't the sole gate), not the only place auth is enforced. Pages
// that read fixture data today (home, runs, journeys) do not yet call auth() themselves; adding
// resource-based checks to them is a follow-up once those pages move off fixtures, not scoped to
// this phase's websites/workspace work.
const isPublicRoute = createRouteMatcher([
  '/api/health',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/create-organization(.*)',
]);

// Deliberately not part of isPublicRoute's exclusion list below — visiting this page still
// requires sign-in (auth.protect() runs for it), only the *organization* requirement is skipped,
// so a signed-out user is still sent to /sign-in first, same as any other route.
const isCreateOrganizationRoute = createRouteMatcher(['/create-organization(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    if (isCreateOrganizationRoute(request)) {
      // Still requires sign-in, just not an active org — see the comment above.
      await auth.protect();
    }
    return;
  }

  const { userId, orgId } = await auth.protect();
  // A signed-in user with no active Clerk Organization (Nori's workspace concept — see
  // plan/PHASE_3_PLAN.md section 2) can't use anything else in the app yet. Redirecting here,
  // where the actual request path is known, avoids the same class of infinite-redirect bug the
  // sign-in/sign-up exclusion above exists to prevent: apps/web/src/app/layout.tsx wraps every
  // route including /create-organization itself, so a root-layout-level redirect on this
  // condition would redirect /create-organization to itself.
  if (!orgId && userId) {
    return NextResponse.redirect(new URL('/create-organization', request.url));
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
