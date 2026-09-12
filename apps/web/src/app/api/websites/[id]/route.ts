import { NextResponse } from 'next/server';
import { getWebsiteById } from '@nori/db';
import type { ApiError } from '@nori/contracts';
import { UnauthorizedError, requireWorkspace } from '../../../../lib/workspace-auth';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await requireWorkspace();
    // Scoped by workspace.id — a website belonging to a different workspace returns 404, not
    // the website, even if the id is otherwise valid. This is what enforces cross-workspace
    // isolation for this endpoint (see plan/PHASE_3_PLAN.md section 4.6).
    const website = await getWebsiteById(workspace.id, id);
    if (!website) {
      return errorResponse({ code: 'not_found', message: 'Website not found.' }, 404);
    }
    return NextResponse.json(website);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    console.error('GET /api/websites/[id] failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
