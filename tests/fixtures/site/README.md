# Fixture site

Owned Phase 4 website for deterministic browser tests. It includes a successful newsletter
subscription, broken links, a misleading CTA, a keyboard-focus problem, a delayed response, a
server error, an unsafe redirect, and an unclickable action used by lifecycle tests.

Run it from the repository root:

```bash
npm run dev:fixture-site
```

It listens on port 8082 by default. Set `FIXTURE_SITE_PORT` to override it.
