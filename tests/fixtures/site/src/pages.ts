// Plain HTML strings for each fixture page — see plan/PHASE_4_PLAN.md section 4.1. Each page
// exists to exercise one specific usability problem the worker's fixed script and (later, real
// persona agents in Phase 5) should be able to observe and report on.

const shell = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; }
  a { color: #2563eb; }
  button { font: inherit; padding: 0.6rem 1.2rem; cursor: pointer; }
  nav { margin-bottom: 2rem; }
  nav a { margin-right: 1rem; }
</style>
</head>
<body>
<nav>
  <a href="/">Home</a>
  <a href="/broken-links">Broken links</a>
  <a href="/confusing-cta">Confusing CTA</a>
  <a href="/focus-trap">Focus trap</a>
  <a href="/slow">Slow</a>
  <a href="/error">Error</a>
</nav>
${body}
</body>
</html>`;

// Clear success path: a two-step subscribe flow the worker's fixed script can complete
// deterministically (click "Subscribe" -> confirmation appears). No JS framework — a single
// inline <script> toggling a hidden confirmation block is enough to prove a real click-and-
// observe cycle works end to end.
export const homePage = shell(
  'Nori Fixture Site',
  `
  <h1>Weekly Newsletter</h1>
  <p>Get one email a week. No spam.</p>
  <button id="subscribe-btn" onclick="document.getElementById('confirmation').hidden = false; this.hidden = true;">
    Subscribe
  </button>
  <p id="confirmation" hidden>You're subscribed. Thanks!</p>
`,
);

export const brokenLinksPage = shell(
  'Broken Links',
  `
  <h1>Resources</h1>
  <ul>
    <li><a href="/does-not-exist">Getting started guide</a></li>
    <li><a href="/also-missing">Pricing</a></li>
    <li><a href="/">Home (this one works)</a></li>
  </ul>
`,
);

// Confusing CTA: the button is labeled "Learn more" but actually submits a purchase — a
// mislabeled-action problem a persona agent (Phase 5) should be able to flag as friction.
export const confusingCtaPage = shell(
  'Confusing CTA',
  `
  <h1>Pro Plan</h1>
  <p>$19/month, cancel anytime.</p>
  <button onclick="document.getElementById('result').textContent = 'Purchase confirmed — you were not asked to pay.'">
    Learn more
  </button>
  <p id="result"></p>
`,
);

// Keyboard-focus issue: the only interactive element has tabindex="-1", so it's unreachable by
// Tab despite being visibly clickable — a real accessibility_signal-category problem.
export const focusTrapPage = shell(
  'Focus Trap',
  `
  <h1>Settings</h1>
  <p>Save your preferences below.</p>
  <button tabindex="-1" onclick="document.getElementById('saved').hidden = false">Save</button>
  <p id="saved" hidden>Saved.</p>
`,
);

export const errorPage = shell(
  'Server Error',
  `
  <h1>500 — Something went wrong</h1>
  <p>The server hit an unexpected error rendering this page.</p>
`,
);
