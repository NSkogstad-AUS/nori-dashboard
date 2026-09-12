import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { AnthropicActionModel } from '@nori/agent';
import { claimJobById, getDb, getPersonaReportBySessionId } from '@nori/db';
import { processJob } from './main.js';
import { seedFixtureJob } from './run-fixture-job.js';

for (const name of ['ANTHROPIC_API_KEY', 'DATABASE_URL'] as const) {
  if (!process.env[name]?.trim()) delete process.env[name];
}
process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '..', '.env'));

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  const queued = await seedFixtureJob({ agentMode: true });
  const job = await claimJobById(queued.id, `phase5-cli-${randomUUID().slice(0, 8)}`);
  if (!job) throw new Error(`could not claim seeded job ${queued.id}`);

  await processJob(job, {
    allowPrivateTargets: true,
    model: new AnthropicActionModel(),
  });
  const report = await getPersonaReportBySessionId(job.sessionId);
  if (!report) throw new Error(`persona run ${job.sessionId} did not produce a report`);
  console.log(
    JSON.stringify(
      {
        runId: job.runId,
        sessionId: job.sessionId,
        outcome: report.outcome,
        summary: report.summary,
        evidenceStepIds: report.evidenceStepIds,
        modelId: report.modelId,
        promptVersion: report.promptVersion,
        inputTokens: report.inputTokens,
        outputTokens: report.outputTokens,
        costUsd: report.costUsd,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await getDb().end();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('[phase5] failed', error);
    await getDb().end();
    process.exit(1);
  });
