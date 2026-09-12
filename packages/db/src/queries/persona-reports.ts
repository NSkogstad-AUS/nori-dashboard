import type { PersonaReport, PersonaReportOutcome } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

function rowToPersonaReport(row: Record<string, unknown>): PersonaReport {
  const report = rowToCamelCase<PersonaReport>(row);
  return { ...report, costUsd: Number(report.costUsd) };
}

export interface CreatePersonaReportInput {
  runId: string;
  sessionId: string;
  outcome: PersonaReportOutcome;
  summary: string;
  evidenceStepIds: string[];
  modelProvider: string;
  modelId: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function createPersonaReport(input: CreatePersonaReportInput): Promise<PersonaReport> {
  const sql = getDb();
  return sql.begin(async (transaction) => {
    const [row] = await transaction<Record<string, unknown>[]>`
      insert into persona_reports (
        run_id, session_id, outcome, summary, model_provider, model_id, prompt_version,
        input_tokens, output_tokens, cost_usd
      ) values (
        ${input.runId}, ${input.sessionId}, ${input.outcome}, ${input.summary},
        ${input.modelProvider}, ${input.modelId}, ${input.promptVersion}, ${input.inputTokens},
        ${input.outputTokens}, ${input.costUsd}
      )
      returning id, run_id, session_id, outcome, summary, model_provider, model_id,
        prompt_version, input_tokens, output_tokens, cost_usd, created_at
    `;
    if (!row) throw new Error('createPersonaReport: insert returned no row');
    const report = rowToPersonaReport({ ...row, evidence_step_ids: [] });
    for (const stepId of input.evidenceStepIds) {
      await transaction`
        insert into persona_report_steps (report_id, step_id)
        values (${report.id}, ${stepId})
      `;
    }
    return { ...report, evidenceStepIds: input.evidenceStepIds };
  });
}

export async function getPersonaReportBySessionId(
  sessionId: string,
): Promise<PersonaReport | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select r.id, r.run_id, r.session_id, r.outcome, r.summary, r.model_provider, r.model_id,
      r.prompt_version, r.input_tokens, r.output_tokens, r.cost_usd, r.created_at,
      coalesce(
        array_agg(rs.step_id) filter (where rs.step_id is not null),
        array[]::uuid[]
      ) as evidence_step_ids
    from persona_reports r
    left join persona_report_steps rs on rs.report_id = r.id
    where r.session_id = ${sessionId}
    group by r.id
  `;
  return row ? rowToPersonaReport(row) : null;
}
