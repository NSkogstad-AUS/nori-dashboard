# Phase 5 Plan — One real persona agent, end to end

Created: 12 September 2026
Status: Implementation complete; live Claude acceptance pending a configured API key.
Parent: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), Phase 5 checklist.

## Purpose

Phase 5 replaces Phase 4's fixed click script with one model-selected persona loop while retaining
the deterministic Playwright executor and all network controls. The first persona is Alex, a
first-time visitor. The first task remains the owned fixture's newsletter subscription.

## Decisions

- Anthropic's official TypeScript SDK drives action selection. The default model is
  `claude-sonnet-5`, configurable with `ANTHROPIC_MODEL`.
- Claude receives a compact current-page observation and screenshot, then must call one strict
  `browser_action` tool. It never receives direct Playwright or network access.
- Website text is untrusted input. It cannot change origins, reveal credentials, authorize
  uploads, purchases, messages, or other external side effects.
- Reasoning is not persisted. Reports retain only concise observations, actions, evidence IDs,
  model/prompt versions, token usage, outcome, summary, and calculated cost.
- A task failure is a completed persona report with `task_failure`. Invalid model output and loop
  failures are `model_failure`; browser, storage, database, and runtime failures are
  `infrastructure_failure`.

## Checklist

- [x] Define versioned persona, page-observation, bounded-action, decision, usage, and report
      contracts.
- [x] Seed the real Alex persona independently of the Phase 4 system runner.
- [x] Build a DOM observation containing URL, title, bounded visible text, actionable element IDs,
      accessible labels, type, role, and disabled state, plus an optional screenshot.
- [x] Add the official Anthropic adapter with a strict `browser_action` tool and versioned system
      prompt.
- [x] Validate every model action against the current observation and Phase 4 navigation policy.
- [x] Execute navigate, click, scroll, type, wait, capture, and finish deterministically in
      Playwright.
- [x] Block password/file/hidden input, unknown or disabled elements, unsafe navigation, downloads,
      and non-fixture execution.
- [x] Enforce action, wall-clock, repeat-loop, token-cost, and cancellation limits.
- [x] Persist action steps, screenshots, run cost, failure classification, and an evidence-linked
      persona report.
- [x] Add a claimed-job Chromium integration test proving Alex completes the fixture task and the
      report reconciles with stored steps.
- [x] Add policy tests for prompt-injection text, invalid actions, sensitive typing, repeated
      actions, and the hard cost cap.
- [ ] Run the same fixture journey through the live Anthropic API. The local `.env` currently has
      the placeholder `ANTHROPIC_API_KEY`, so this external acceptance check cannot run yet.

## Acceptance gate

The deterministic adapter integration passes: a real browser session observes the owned fixture,
selects and executes actions through the model boundary, confirms the visible success state, and
stores an evidence-linked report. Phase 5 becomes complete when the same path passes once with the
live Anthropic adapter and configured key using:

```bash
npm run dev:fixture-site
npm run run-agent-fixture --workspace=apps/worker
```

## Session notes

### 2026-09-12 — Implementation

Added the Phase 5 contracts, Anthropic tool-use adapter, prompt boundary, loop controller,
Playwright action executor, Alex seed, database migration and queries, claimed-job integration,
and one-shot fixture CLI. Automated coverage passes with an injected deterministic model at the
same interface used by the Anthropic adapter. The live run was attempted, but stopped before any
API request because `ANTHROPIC_API_KEY` is still the example placeholder.
