# Integration tests

The Phase 4 suite covers workspace isolation, navigation safety, and a real Chromium fixture run
that persists steps and PNG artifacts. Run it after migrations with `npm run test:integration`.

`fixture-run.test.ts` starts and stops the owned fixture site itself. Chromium must be installed
once with `npx playwright install chromium`; CI installs it automatically.
