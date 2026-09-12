import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listPersonas } from '@nori/db';
import type { ApiError } from '@nori/contracts';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

// Personas are a shared library, not workspace-scoped (see packages/contracts/src/entities.ts —
// personaSchema has no workspaceId), so this only requires sign-in, not a resolved workspace —
// unlike api/websites and api/runs, which call requireWorkspace(). Used by NewRunDialog (via
// AppShellFrame) to resolve real persona ids instead of the fixture UUIDs the dialog's picker
// data used to carry, which never matched a real personas.id.
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse({ code: 'unauthorized', message: 'No signed-in user.' }, 401);
    }
    const personas = await listPersonas();
    return NextResponse.json({ items: personas });
  } catch (error) {
    console.error('GET /api/personas failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
