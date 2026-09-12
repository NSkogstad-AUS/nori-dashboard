# Integration tests

The suite covers workspace isolation, navigation safety, Phase 4's fixed Chromium run, and Phase
5's bounded persona loop and evidence-linked report. Run it after migrations with
`npm run test:integration`.

The browser integration files start and stop their own fixture servers. Chromium must be installed
once with `npx playwright install chromium`; CI installs it automatically. The Anthropic adapter
is exercised live through `npm run run-agent-fixture --workspace=apps/worker` when a real API key
is configured; routine CI uses a deterministic model at the same interface and makes no paid API
calls.
