import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  homePage,
  brokenLinksPage,
  confusingCtaPage,
  focusTrapPage,
  errorPage,
  thirdPartyResourcePage,
  unclickablePage,
} from './pages.js';

// Owned fixture website for Phase 4's deterministic worker testing — see
// plan/PHASE_4_PLAN.md section 4.1. Deliberately dependency-free (plain node:http, no Express):
// five static-ish pages is not enough surface area to justify a framework dependency.

const PORT = Number(process.env.FIXTURE_SITE_PORT ?? 8082);

function respondHtml(res: import('node:http').ServerResponse, status: number, html: string) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    switch (url.pathname) {
      case '/':
        respondHtml(res, 200, homePage);
        return;
      case '/broken-links':
        respondHtml(res, 200, brokenLinksPage);
        return;
      case '/confusing-cta':
        respondHtml(res, 200, confusingCtaPage);
        return;
      case '/focus-trap':
        respondHtml(res, 200, focusTrapPage);
        return;
      case '/slow':
        // Artificial delay to exercise timeout/slow-page handling.
        await sleep(5000);
        respondHtml(res, 200, homePage);
        return;
      case '/slow-navigation':
        // A healthy response outside the former one-second policy window must still load.
        await sleep(1500);
        respondHtml(res, 200, homePage);
        return;
      case '/redirect-unsafe':
        res.writeHead(302, { location: 'http://127.0.0.1:9999/internal' });
        res.end();
        return;
      case '/unclickable':
        respondHtml(res, 200, unclickablePage);
        return;
      case '/third-party-resource':
        respondHtml(res, 200, thirdPartyResourcePage);
        return;
      case '/error':
        respondHtml(res, 500, errorPage);
        return;
      default:
        respondHtml(res, 404, '<h1>404</h1><p>Not found.</p>');
    }
  })();
});

server.listen(PORT, () => {
  console.log(`[fixture-site] listening on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
