import { createServer } from 'node:http';

// Phase 1 skeleton: this process has no job processing wired up yet.
// It only proves the worker can start, report health, and shut down cleanly.

const PORT = Number(process.env.PORT ?? 8081);

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`[worker] Phase 1 skeleton started, health check on http://localhost:${PORT}/health`);
  console.log('[worker] No job processing is wired up yet — see TODO in this file.');
});

// TODO(Phase 4/5/6): replace this skeleton with the real job-claim loop:
//   - poll packages/db's jobs table (see packages/db/src/migrations/002_queue.sql) for
//     leasable persona-session jobs, claim via leased_by/leased_until, heartbeat while running
//   - launch an isolated Playwright browser context per claimed persona session (Phase 4)
//   - run the persona agent's observe/act loop against the browser (Phase 5)
//   - release/complete/fail the lease and persist steps, artifacts, and run events (Phase 6)

function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down gracefully`);
  server.close((err) => {
    if (err) {
      console.error('[worker] error while closing health server', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
