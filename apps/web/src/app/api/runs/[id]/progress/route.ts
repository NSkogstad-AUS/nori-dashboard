import { NextResponse } from 'next/server';
import {
  getRunById,
  getPersonaReportBySessionId,
  listSessionsForRun,
  listStepsForSession,
} from '@nori/db';
import type { ApiError } from '@nori/contracts';
import { UnauthorizedError, requireWorkspace } from '../../../../../lib/workspace-auth';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

// Polled by the Journeys page's live progress tracker (see plan/PHASE_5_PLAN.md's session log)
// while a run is active. Returns the run plus, for each of its persona sessions, the session row,
// its ordered steps, and its persona report (null until the session finishes) — everything the
// tracker needs to render stage progress and dot-point steps without a second round trip.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await requireWorkspace();
    // Scoped by workspace.id — a run belonging to a different workspace returns 404, not the
    // run, even if the id is otherwise valid (matches api/websites/[id]/route.ts's pattern).
    const run = await getRunById(workspace.id, id);
    if (!run) {
      return errorResponse({ code: 'not_found', message: 'Run not found.' }, 404);
    }

    const sessions = await listSessionsForRun(run.id);
    const sessionDetails = await Promise.all(
      sessions.map(async (session) => {
        const [steps, report] = await Promise.all([
          listStepsForSession(session.id),
          getPersonaReportBySessionId(session.id),
        ]);
        return { session, steps, report };
      }),
    );

    return NextResponse.json({ run, sessions: sessionDetails });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    console.error('GET /api/runs/[id]/progress failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
