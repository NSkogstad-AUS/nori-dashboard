import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createWebsite, listWebsitesForWorkspace } from '@nori/db';
import { createWebsiteRequestSchema, type ApiError } from '@nori/contracts';
import { UnauthorizedError, requireWorkspace } from '../../../lib/workspace-auth';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const websites = await listWebsitesForWorkspace(workspace.id);
    return NextResponse.json({ items: websites });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    console.error('GET /api/websites failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspace = await requireWorkspace();
    const body: unknown = await request.json().catch(() => null);
    const parsed = createWebsiteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        {
          code: 'validation_failed',
          message: 'Invalid website payload.',
          details: { issues: parsed.error.issues },
        },
        400,
      );
    }
    const website = await createWebsite(workspace.id, parsed.data);
    return NextResponse.json(website, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    // A duplicate (workspace_id, origin) violates the unique constraint in
    // packages/db/src/migrations/001_init.sql — surface it as a clear conflict rather than a
    // generic 500.
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      return errorResponse(
        { code: 'validation_failed', message: 'This website is already tracked in your workspace.' },
        409,
      );
    }
    console.error('POST /api/websites failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
