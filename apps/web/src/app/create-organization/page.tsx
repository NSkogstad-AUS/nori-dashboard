// Shown when a signed-in user has no active Clerk Organization — Clerk Organizations are Nori's
// workspace concept (see plan/PHASE_3_PLAN.md section 2), so nothing else in the app is usable
// until one exists. Uses Clerk's prebuilt <CreateOrganization>, matching how sign-in/sign-up use
// <SignIn>/<SignUp> (see apps/web/src/app/sign-in, sign-up).

import { CreateOrganization } from '@clerk/nextjs';

export default function CreateOrganizationPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <CreateOrganization afterCreateOrganizationUrl="/" />
    </div>
  );
}
