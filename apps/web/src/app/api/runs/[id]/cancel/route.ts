import { NextResponse } from 'next/server';
import { cancelRunImmediately } from '@nori/db';
import type { ApiError } from '@nori/contracts';
import { UnauthorizedError, requireWorkspace } from '../../../../../lib/workspace-auth';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await requireWorkspace();
    const result = await cancelRunImmediately(workspace.id, id);

    if (result === 'not_found') {
      return errorResponse({ code: 'not_found', message: 'Run not found.' }, 404);
    }

    if (result === 'terminal') {
      return errorResponse(
        { code: 'validation_failed', message: 'This run has already finished.' },
        409,
      );
    }

    return NextResponse.json({ state: 'cancelled', cancelRequestState: 'cancelled' });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    console.error('POST /api/runs/[id]/cancel failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
