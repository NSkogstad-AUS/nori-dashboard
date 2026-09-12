# Phase 2 Plan — Turn the chosen design into application components

Created: 12 September 2026
Status: Planning only. No Phase 2 implementation has started.
Parent: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), Phase 2 checklist.

This document is the detailed working plan for Phase 2. It exists because Phase 2 has enough
surface area (design-token extraction, ~16 components, 7 views/dialogs, accessibility work) that
the one-paragraph checklist in the master plan isn't enough to execute against directly. Treat this
file the same way the master plan treats itself: a checklist to work through in order, not just a
spec — check items off as they're completed, and append session notes at the bottom.

## 1. Purpose and scope

Phase 2 replaces the static Journey Atlas prototype (`prototype/index.html` / `app.js` /
`styles.css`) with real, stateful React components rendered by `apps/web` (Next.js App Router),
styled from design tokens extracted into `packages/ui`, and populated with fixture data shaped to
the `@nori/contracts` entity schemas built in Phase 1.

**In scope:**
- Extracting the Soft Spectrum design tokens into `packages/ui`.
- Building the full component set named in the master plan's Phase 2 checklist.
- Porting every view and dialog that exists in the prototype today.
- Fixture data that type-checks against `@nori/contracts` schemas.
- Accessibility parity with (or improvement on) the prototype.
- Loading/empty/error/unavailable-artifact/permission-denied UI states, even though nothing
  async exists yet to trigger them for real.

**Explicitly out of scope** (belongs to later phases — do not start it here):
- Authentication, workspaces, or any database-backed persistence (Phase 3).
- Real browser execution, sandboxing, or the fixture *website* under `tests/fixtures/site`
  (Phase 4 — not to be confused with this document's fixture *data*).
- A real persona agent or model calls (Phase 5).
- Durable jobs, queue polling in `apps/worker` (Phase 6).
- Real journey paths derived from persisted steps (Phase 7).
- Live SSE transmission, real screenshots (Phase 8).
- Evidence-backed finding generation (Phase 9).

If implementation work in this phase starts to require any of the above, stop and flag it rather
than quietly building a shortcut version — this mirrors the master plan's rule against mixing
design migration with agent-system work.

## 2. Design token extraction

Source of truth: the **final** `:root` block near the bottom of `prototype/styles.css` (the file
redefines tokens twice — an earlier draft palette near the top of the file, then a second `:root`
block just before the `body[data-design="1"]` override at the very end, which is the one actually
in effect for Journey Atlas since CSS custom properties cascade and the later declaration wins).
Use the later block as ground truth, not the first one.

Tokens to extract:

| Token | Source | Notes |
| --- | --- | --- |
| `--ink`, `--muted`, `--paper`, `--line` | final `:root` | base text/surface colors |
| `--accent`, `--coral`, `--peach`, `--blue`, `--violet`, `--lime` | final `:root` | persona/category accent colors |
| `--workspace` | final `:root` | app background surface |
| `--spectrum` | final `:root` | the multi-stop radial-gradient background used behind the welcome panel and persona shelf |
| Radii | inline across rules (`.pill` 30px, `.circle` 50%, `.map-panel`/`.journey-node`/`.person` 14–28px, `dialog` 27px) | consolidate into a small radius scale (e.g. `--radius-sm/md/lg/pill`) rather than copying magic numbers everywhere |
| Spacing | inline paddings/gaps across `.shell`, `.rail`, `.persona-shelf`, `.map-panel` | consolidate into a spacing scale; the prototype doesn't have one today, so this is a genuine improvement, not just a port |
| Shadows | `.shell`, `.pill/.circle`, `.journey-node`, `.floating-dock`, `dialog` box-shadows | consolidate into `--shadow-sm/md/lg` |
| Motion | the `@media(prefers-reduced-motion:no-preference)` block (button/hover transitions, `.shell` grid-template-columns transition, `appear` keyframes, dialog open animation) | must stay gated behind `prefers-reduced-motion` exactly as today — this is the accessibility requirement, not just style |

**Explicitly do not port:** any rule scoped under `body[data-design="2"]` (timeline/lane layout),
`body[data-design="3"]` (kanban board), `body[data-design="4"]` (profile-lens layout), or the
`.concept-bar`/`data-concept` rules. These belong to the abandoned 5-concept comparison and the
master plan is explicit that "no new five-concept selector is introduced." Rules under
`body[data-design="1"]` and `"5"` that duplicate what the final Soft Spectrum block already
overrides should also be dropped — only port a rule once, using its final effective value.

**Format decision:** ship tokens as CSS custom properties in a single stylesheet
(`packages/ui/src/tokens/tokens.css`) rather than a TS token object. The prototype is already
100% custom-property-driven, dark/light or theming isn't in scope yet, and Tailwind isn't in use
here — a plain CSS file imported once at the root of `apps/web` (in `app/layout.tsx`) is the
lowest-friction path and keeps `packages/ui` framework-agnostic.

## 3. Package layout

```text
packages/ui/
  src/
    tokens/
      tokens.css          # extracted custom properties, organized under headed comments
    components/
      AppShell.tsx
      Sidebar.tsx
      WebsiteSwitcher.tsx
      PageHeader.tsx
      FloatingDock.tsx
      PersonaShelf.tsx
      PersonaPill.tsx
      JourneyViewSwitch.tsx
      JourneyStage.tsx
      JourneyStep.tsx
      RunCard.tsx
      NewRunDialog.tsx
      FindingDrawer.tsx
      BrowserViewport.tsx
      PlaybackControls.tsx
      CaptureStrip.tsx
      Dialog.tsx           # shared native <dialog> wrapper (focus trap/restore), not in the master list but needed to implement the dialog components without duplicating logic 3x
      FixtureModeBadge.tsx  # see section 7
    index.ts               # re-exports everything above
    styles/
      components.css        # component-level CSS ported from prototype/styles.css, using the tokens

apps/web/
  src/
    app/
      layout.tsx            # imports packages/ui token + component CSS once
      page.tsx               # Home / overview
      journeys/page.tsx      # Journeys (Overview + Live view, mode is client state not a route)
      runs/page.tsx
      websites/page.tsx
      api/health/route.ts    # unchanged from Phase 1
    fixtures/
      personas.ts
      websites.ts
      runs.ts
      sessions.ts
      steps.ts
      findings.ts
      index.ts               # re-exports the fixture dataset as one object
    context/
      workspace-context.tsx
      journey-view-context.tsx
    lib/
      journey-derivations.ts # helpers mapping Step/Finding fixture data into UI-shaped view models (see section 5)
```

`packages/ui` needs `react` and `react-dom` added as peer dependencies now (it was left out in
Phase 1 deliberately, pending this decision). Use the same major versions pinned in `apps/web`.

## 4. Fixture data — shaped to `@nori/contracts`

Fixture data must satisfy the zod schemas in `packages/contracts/src/entities.ts`. Concretely,
porting the prototype's fixture arrays means:

- `people` (4 personas: Alex/Jamie/Sam/Riley) → `Persona[]`. Map `role` into `goal`, and write a
  short `behavior` string per persona (none exists in the prototype — invent a one-sentence
  behavior description consistent with the existing `role`). Populate `device` with a plausible
  desktop viewport + user agent; `limitations: []`. Assign real `id` (uuid) and `version: 1`.
- `sites` (Acme/Forma/Orbit) → `Website[]`, scoped to one fixture `workspaceId` (also fixture,
  matching `Workspace`/`Membership` shape even though nothing reads those tables yet).
  `authorizationStatus: 'fixture'` for all of them, matching the Phase 0 decision to keep the
  first release on owned fixtures only.
- `runs` (4 fictional runs) → `Run[]`, each referencing a `websiteId`, with `state: 'completed'`
  for the pre-existing runs and a way to create a `state: 'queued'` run via the New Run dialog
  (see section 5). `limits` should default to the Phase 0 session limits (20 actions / 180s /
  $0.50 cap) already modeled in `RunLimits`.
- One `PersonaSession` per persona per run that has been "run" (i.e. the 4 prototype runs each
  imply 4 persona sessions in the original data, since `actions`/`frames` are indexed by
  `[person][stage]`). `state: 'completed'`.
- `stages` (Discover/Explore/Sign up/Get started) + `actions` → `Step[]`, one per
  `(session, stage)` pair, `sequence` = stage index, `action` picked sensibly (mostly `navigate`,
  the persona-library "clicks" become `click`), `outcome: 'success'` unless a `Finding` exists at
  that step, then still `'success'` (findings are frictions, not hard failures, matching the
  prototype's framing — nothing in the prototype models an `'error'`/`'blocked'` step, so Phase 2
  should add **one or two** such steps to exercise those states in the UI, since section 6 below
  requires error-state UI to exist and be visibly reachable).
- `findings` (6 fictional findings) → `Finding[]`, referencing `personaSessionIds`/`stepIds`
  instead of the prototype's flat `person`/`stage` indices — this requires a lookup at
  fixture-build time (`lib/journey-derivations.ts` or directly in `fixtures/findings.ts`) that
  resolves `(person, stage)` into the synthesized session/step uuids. `category` maps loosely from
  the prototype's implicit framing (e.g. "Plan differences are easy to miss" → `clarity`, "Focus
  skips the main navigation" → `accessibility_signal`); `severity` maps directly
  (Moderate/High → `moderate`/`high`); `confidence` is a new field the prototype has no equivalent
  for — pick a plausible fixed value (e.g. `0.7`) per finding rather than fabricating false
  precision. `inferredExplanation` can be `null` for straightforward ones or a short synthesized
  sentence where it adds clarity beyond `observedFact`.

Keep a short header comment in every fixture file stating it is fixture-only data, matching the
"never present fixture data... as actual test results" rule from the master plan section 1.

## 5. State management design

Plain React state + Context, no new dependency, matching the confirmed decision.

- **`WorkspaceContext`** — `{ selectedWebsiteId, setSelectedWebsiteId, collapsed, setCollapsed }`.
  Replaces the prototype's `state.site` / `state.collapsed`. Provided once at the `apps/web`
  layout root, wrapping `AppShell`.
- **`JourneyViewContext`** — `{ mode: 'overview' | 'live', setMode, selectedPersonId,
  setSelectedPersonId, onlyIssues, setOnlyIssues, frameBySession: Record<sessionId, number>,
  setFrame, captureFramesBySession: Record<sessionId, number[]>, addCapture, playing, setPlaying,
  captureMessage, setCaptureMessage }`. Replaces `state.mode/person/onlyIssues/frames/captures/
  playing/captureMessage`. Scoped to the Journeys route/page, not global — it doesn't need to
  survive navigation to Runs/Websites the way workspace selection does.
- **Dialogs** — a shared `Dialog` component (`packages/ui/src/components/Dialog.tsx`) wraps a
  native `<dialog>` element, exposing `open`, `onClose`, and handling `showModal()`/`close()` plus
  restoring focus to the trigger element on close (`useRef` on the trigger, passed down or tracked
  via a small `useDialogTrigger` hook) — this directly implements the master plan's "dialog focus
  restoration" requirement. `NewRunDialog` and `FindingDrawer` (finding detail dialog) and a
  `PersonaLibraryDialog` (component not explicitly named in the master list, but required since
  the prototype has this as its third dialog type) all build on top of `Dialog`, each owning its
  own local state (e.g. the New Run form's URL input + persona checkboxes + validation error).
- **Routing** — replace the prototype's `state.view` switch + `history.replaceState(null,'','#1')`
  hash hack with real Next.js routes: `/`, `/journeys`, `/runs`, `/websites`. No hash-based
  concept-switcher remnant carries over. `AppShell`'s `Sidebar` links become real `<Link>`s;
  `WebsiteSwitcher` selection stays in `WorkspaceContext` rather than the URL for now (query-param
  based site switching can be revisited in Phase 3 once real data loading is involved).

## 6. View-by-view porting notes

| Prototype source | Target | Preserve |
| --- | --- | --- |
| `render()` shell markup (`.shell`, `.rail`, `.rail-sites`, `.workspace-header`, `.page-heading`, `.floating-dock`) | `AppShell`, `Sidebar`, `WebsiteSwitcher`, `PageHeader`, `FloatingDock` | Collapse/expand behavior (`aria-expanded`, focus stays on toggle), active-route highlighting, floating dock quick actions |
| `overview()` | Home page (`app/page.tsx`) composing `RunCard`-adjacent summary sections | Metric panel counts, "where people pause" mini-stage summary, recent runs list |
| `personaShelf()` | `PersonaShelf` + `PersonaPill` | Selection toggle semantics differ by mode (multi-select-like in Overview vs. single-select in Live, exactly as the prototype's click handler special-cases `state.mode==='live'`) — encode this as a prop (`selectionMode: 'toggle' | 'single'`) rather than hardcoding view-mode branching inside the pill |
| `journeyContent()` / `atlas()` | Journeys Overview: `JourneyViewSwitch` + `PersonaShelf` + `JourneyStage`/`JourneyStep` grid | "Issues only" filter, "All perspectives" clear, the `→` connector between stage columns, the quiet/no-issue node state |
| `liveView()` / `browserFrame()` | Journeys Live view: `BrowserViewport`, `PlaybackControls`, `CaptureStrip` | `setInterval`-driven autoplay → `useEffect` with `setInterval`/`clearInterval` cleanup on unmount and on `playing`/`mode` change (prototype already guards on `dialog.open`/`document.hidden`/wrong view — replicate those guards as effect dependencies/early-returns); capture dedupe (`if (!captures[person].includes(frame))`); focus-preserving frame navigation |
| `runCards()` | Runs page, `RunCard` + "new run" entry card | Per-site filtering, "Setup only" pending-run tag for runs created via the New Run dialog |
| `websites()` | Websites page | Run counts per site |
| `showFinding()` | `FindingDrawer` (built on `Dialog`) | Evidence strip, severity tag, disclaimer text |
| `newRun()` + submit handler | `NewRunDialog` (built on `Dialog`) | URL validation logic (protocol/hostname/credentials checks — port the existing `try/catch` validation almost verbatim, it's already solid), persona checkbox selection, inline error message via `aria-live`/`role="alert"`, success announcement via a visually-hidden live region (`#announcement` in the prototype) |
| `personas` library dialog action | `PersonaLibraryDialog` (built on `Dialog`) | Same library-card layout as today |

## 7. Accessibility and states checklist

Directly from the master plan's Phase 2 checklist:

- [ ] Keyboard navigation across sidebar, persona shelf, stage grid, and dialogs.
- [ ] Dialog focus restoration on close (see `Dialog` component above).
- [ ] Screen-reader labels — preserve every existing `aria-label`, `aria-pressed`, `role="status"`,
  `role="alert"`, and the visually-hidden `#announcement` live region exactly; add labels
  anywhere the prototype was already relying on visible text alone in a way that won't translate
  to a componentized structure.
- [ ] Reduced motion — all transitions/animations gated behind `prefers-reduced-motion:
  no-preference`, matching the token extraction in section 2.
- [ ] Loading, empty, error, unavailable-artifact, and permission-denied states — new work, since
  the prototype is fully synchronous. Add these as real, visually-designed states in the relevant
  components now (e.g. `BrowserViewport` gets an "artifact unavailable" placeholder state,
  `RunCard`/journey grid get empty-state copy for a site with zero runs, a generic
  `PermissionDeniedPanel` for later reuse) even though nothing in Phase 2 triggers them from real
  async data — Phase 3+ should be able to wire these up without a redesign. Use the fixture step
  with `outcome: 'error'`/`'blocked'` added in section 4 to exercise the error state in at least
  one real spot in the UI (e.g. render it distinctly in `JourneyStep`).
- [ ] Keep the stage map / journey board horizontally scrollable on narrow screens without the
  whole page overflowing — port the existing `.scroll-area`/`min-width` pattern from
  `prototype/styles.css` as-is; it already does this correctly.

## 8. Fixture-vs-real-run visual distinction

The master plan requires fixture mode to stay "visibly separate from real-run mode." The prototype
already does this via a `.sample-badge` ("Sample workspace") in the header and scattered
disclaimer text ("Simulated browser frames...", "Illustrative finding, not a test result...",
"Creates a local sample run only..."). Phase 2 should consolidate this into one reusable
`FixtureModeBadge` component (and a `FixtureDisclaimer` text variant) used consistently at every
point the prototype currently has ad hoc disclaimer copy, rather than duplicating the sentence
inline in five different components. This also makes it trivial for Phase 3+ to swap the badge off
once real runs exist.

## 9. Acceptance gate

Restating the master plan's Phase 2 gate plus concrete criteria to check before calling this phase
done:

- [ ] The selected visual direction (Journey Atlas, Soft Spectrum palette) and its interactions
  survive the migration into React components.
- [ ] No new five-concept selector or `data-design`/`data-concept` switcher is introduced.
- [ ] Every view and dialog present in `prototype/app.js` has a React equivalent: Home, Journeys
  (Overview + Live), Runs, Websites, New Run dialog, Finding dialog, Persona library dialog.
- [ ] Fixture data in `apps/web/src/fixtures` type-checks against `@nori/contracts` schemas
  (verified via `npm run typecheck`).
- [ ] `npm run lint` and `npm run build` pass at the repo root.
- [ ] `prototype/` is left untouched — no edits to the frozen reference.
- [ ] Manual click-through of `npm run dev:web` matches the prototype's interactions side by side:
  persona selection (both selection modes), live-view playback/pause/step/capture, new-run form
  validation (invalid URL, no persona selected, success path), issues-only filtering, sidebar
  collapse, and each dialog's open/close/focus-restore behavior.

## 10. Suggested execution order

Not to be executed in the planning session that produced this document — this is the order for
the implementation pass that follows:

1. Design tokens (`packages/ui/src/tokens/tokens.css`) extracted and verified against the
   prototype rendering (side-by-side visual diff of a couple of key surfaces).
2. Shell components: `AppShell`, `Sidebar`, `WebsiteSwitcher`, `PageHeader`, `FloatingDock`,
   `Dialog`, `FixtureModeBadge`.
3. Fixture data module (`apps/web/src/fixtures`), built and validated against `@nori/contracts`
   schemas before any view consumes it.
4. Home page.
5. Journeys — Overview view (`JourneyViewSwitch`, `PersonaShelf`, `PersonaPill`, `JourneyStage`,
   `JourneyStep`).
6. Journeys — Live view (`BrowserViewport`, `PlaybackControls`, `CaptureStrip`).
7. Runs page + `RunCard`.
8. Websites page.
9. Dialogs: `NewRunDialog`, `FindingDrawer`, `PersonaLibraryDialog`.
10. Accessibility and states pass across everything built above.
11. Manual verification against the prototype, side by side, per section 9.

## Session log

_(Append date, tasks checked off, changed areas, checks actually run, failures/limitations, and
the next single task at the end of each work session, matching the master plan's handoff format.)_
