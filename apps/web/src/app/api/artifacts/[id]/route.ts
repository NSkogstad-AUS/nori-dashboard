import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { getArtifactForWorkspace } from '@nori/db';
import type { ApiError } from '@nori/contracts';
import { resolveArtifactPath } from '../../../../lib/artifact-storage';
import { UnauthorizedError, requireWorkspace } from '../../../../lib/workspace-auth';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await requireWorkspace();
    const artifact = await getArtifactForWorkspace(workspace.id, id);
    if (!artifact) {
      return errorResponse({ code: 'not_found', message: 'Artifact not found.' }, 404);
    }
    if (new Date(artifact.expiresAt).getTime() <= Date.now()) {
      return errorResponse({ code: 'not_found', message: 'Artifact has expired.' }, 404);
    }

    const filePath = resolveArtifactPath(artifact.storageKey);
    if (!filePath) {
      return errorResponse({ code: 'not_found', message: 'Artifact not found.' }, 404);
    }

    const bytes = await readFile(filePath);
    return new Response(bytes, {
      headers: {
        'content-type': artifact.contentType,
        'cache-control': 'private, max-age=60',
        'content-length': String(bytes.byteLength),
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return errorResponse({ code: 'not_found', message: 'Artifact file is unavailable.' }, 404);
    }
    console.error('GET /api/artifacts/[id] failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
