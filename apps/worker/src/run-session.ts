import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  chromium,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Download,
  type Page,
  type Route,
  type WebSocketRoute,
} from 'playwright';
import {
  checkNavigationTarget,
  checkUrlStructure,
  checkWebSocketTarget,
  isPrivateOrReservedIp,
  runAgentLoop,
  resolveTargetAddresses,
  type AgentLoopResult,
  type NavigationCheckOptions,
  type PersonaActionModel,
} from '@nori/agent';
import { addRunCost, appendStep, createArtifact, linkArtifactToStep } from '@nori/db';
import type {
  BrowserAction,
  PageObservation,
  Persona,
  PersonaSession,
  Run,
  Step,
  StepAction,
  StepOutcome,
} from '@nori/contracts';

// This remains deliberately deterministic. Phase 5 can choose actions only after this executor
// and its network boundary have proved safe without a model in the loop.

const DEFAULT_ARTIFACTS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'artifacts-storage',
);
export const ARTIFACTS_ROOT = path.resolve(
  process.env.ARTIFACT_STORAGE_DIR ?? DEFAULT_ARTIFACTS_ROOT,
);

export class SessionLimitExceededError extends Error {}
export class SessionCancelledError extends Error {}
export class UnsafeTargetError extends Error {}

let activeBrowserCount = 0;
export function getActiveBrowserCountForTests(): number {
  return activeBrowserCount;
}

export interface RunSessionOptions {
  run: Run;
  session: PersonaSession;
  navigationOptions: NavigationCheckOptions;
  onHeartbeat?: () => Promise<void>;
  isCancellationRequested?: () => Promise<boolean>;
  monitorIntervalMs?: number;
}

export interface RunPersonaSessionOptions extends RunSessionOptions {
  persona: Persona;
  model: PersonaActionModel;
}

interface SessionBudget {
  actions: number;
  readonly maxActions: number;
  readonly deadlineAt: number;
}

async function browserResolverRules(options: NavigationCheckOptions): Promise<string[]> {
  const rules: string[] = [];
  for (const origin of options.allowedOrigins) {
    const url = new URL(origin);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const structural = checkUrlStructure(origin, options);
    if (!structural.allowed) throw new UnsafeTargetError(`unsafe_target:${structural.reason}`);
    const addresses = await resolveTargetAddresses(origin, options.resolveHostname);
    if (!options.allowPrivateTargets && addresses.some(isPrivateOrReservedIp)) {
      throw new UnsafeTargetError('unsafe_target:resolved_to_private_ip');
    }
    // Bare IP URLs are already pinned by definition. Hostnames are mapped to the exact address
    // that passed validation, preventing a different DNS answer at browser-connect time.
    if (hostname !== addresses[0]) rules.push(`MAP ${hostname} ${addresses[0]}`);
  }
  return rules.length > 0 ? [`--host-resolver-rules=${rules.join(',')}`] : [];
}

function consumeAction(budget: SessionBudget): void {
  budget.actions += 1;
  if (budget.actions > budget.maxActions) {
    throw new SessionLimitExceededError(`exceeded maxActionsPerSession (${budget.maxActions})`);
  }
  if (Date.now() >= budget.deadlineAt) {
    throw new SessionLimitExceededError('exceeded maxSessionSeconds');
  }
}

function remainingMs(budget: SessionBudget): number {
  return Math.max(1, budget.deadlineAt - Date.now());
}

async function recordStep(
  sessionId: string,
  action: StepAction,
  outcome: StepOutcome,
  urlBefore: string | null,
  urlAfter: string | null,
  observation: string | null,
) {
  // Every step recorded in this file happens while the browser is actively navigating/acting —
  // main.ts only calls into runFixedSessionScript/runPersonaAgentSession after transitioning the
  // session to 'exploring', and the 'analysing' stage (producing the persona report) happens
  // afterward, outside this file — so 'exploring' is factually correct for every call site here,
  // not a placeholder.
  return appendStep({ sessionId, action, outcome, urlBefore, urlAfter, observation, sessionState: 'exploring' });
}

async function attachScreenshot(sessionId: string, stepId: string, page: Page): Promise<Buffer> {
  const buffer = await page.screenshot({ type: 'png' });
  const dir = path.join(ARTIFACTS_ROOT, sessionId);
  await mkdir(dir, { recursive: true });
  const fileName = `${stepId}.png`;
  await writeFile(path.join(dir, fileName), buffer);
  const viewport = page.viewportSize();
  const artifact = await createArtifact({
    sessionId,
    stepId,
    storageKey: path.join(sessionId, fileName),
    contentType: 'image/png',
    width: viewport?.width ?? 0,
    height: viewport?.height ?? 0,
  });
  await linkArtifactToStep(stepId, artifact.id);
  return buffer;
}

async function captureScreenshot(sessionId: string, page: Page): Promise<void> {
  const step = await recordStep(
    sessionId,
    'capture',
    'success',
    page.url(),
    page.url(),
    'viewport screenshot',
  );
  await attachScreenshot(sessionId, step.id, page);
}

interface BlockedRequest {
  url: string;
  reason: string;
}

const NETWORK_POLICY_TIMEOUT_MS = 1_000;

async function installNavigationGuard(
  context: BrowserContext,
  navigationOptions: NavigationCheckOptions,
  onBlocked: (blocked: BlockedRequest) => void,
): Promise<void> {
  await context.route('**/*', async (route: Route) => {
    const url = route.request().url();
    const result = await checkNavigationTarget(url, navigationOptions);
    if (!result.allowed) {
      onBlocked({ url, reason: result.reason ?? 'unsafe_target' });
      await route.abort('blockedbyclient');
      return;
    }
    if (route.request().isNavigationRequest()) {
      // Fetch one hop without following redirects. Playwright does not route redirect targets
      // consistently across engines, so inspecting Location before handing the response to the
      // page is the reliable network-boundary check. Keep this preflight bounded so a server
      // that never returns headers cannot prevent timeout or cancellation cleanup.
      let response: APIResponse;
      try {
        response = await route.fetch({
          maxRedirects: 0,
          timeout: NETWORK_POLICY_TIMEOUT_MS,
        });
      } catch {
        onBlocked({ url, reason: 'network_policy_timeout' });
        await route.abort('timedout').catch(() => undefined);
        return;
      }
      const location = response.headers()['location'];
      if (location && response.status() >= 300 && response.status() < 400) {
        const redirectUrl = new URL(location, url).href;
        const redirectResult = await checkNavigationTarget(redirectUrl, navigationOptions);
        if (!redirectResult.allowed) {
          onBlocked({
            url: redirectUrl,
            reason: redirectResult.reason ?? 'unsafe_redirect_target',
          });
          await route.abort('blockedbyclient');
          return;
        }
      }
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });

  await context.routeWebSocket(/.*/, async (socket: WebSocketRoute) => {
    const result = await checkWebSocketTarget(socket.url(), navigationOptions);
    if (!result.allowed) {
      onBlocked({ url: socket.url(), reason: result.reason ?? 'unsafe_websocket_target' });
      await socket.close({ code: 1008, reason: 'Blocked by navigation policy' });
      return;
    }
    socket.connectToServer();
  });
}

function rejectDownload(download: Download, onBlocked: (blocked: BlockedRequest) => void): void {
  onBlocked({ url: download.url(), reason: 'downloads_disabled' });
  void download.cancel();
}

async function monitorSession(
  budget: SessionBudget,
  options: RunSessionOptions,
  signal: AbortSignal,
): Promise<never> {
  const intervalMs = options.monitorIntervalMs ?? 250;
  while (!signal.aborted) {
    if (Date.now() >= budget.deadlineAt) {
      throw new SessionLimitExceededError('exceeded maxSessionSeconds');
    }
    if (await options.isCancellationRequested?.()) {
      throw new SessionCancelledError('run cancellation requested');
    }
    await options.onHeartbeat?.();
    try {
      await delay(intervalMs, undefined, { signal });
    } catch (error) {
      if (signal.aborted) break;
      throw error;
    }
  }
  throw new SessionCancelledError('session monitor stopped');
}

async function executeFixedActions(
  page: Page,
  run: Run,
  session: PersonaSession,
  budget: SessionBudget,
  navigationOptions: NavigationCheckOptions,
  getBlockedRequest: () => BlockedRequest | null,
): Promise<void> {
  const throwIfBlocked = async () => {
    const blocked = getBlockedRequest();
    if (!blocked) return;
    const reason = `unsafe_target:${blocked.reason}`;
    await recordStep(session.id, 'navigate', 'blocked', page.url(), blocked.url, reason);
    throw new UnsafeTargetError(reason);
  };

  consumeAction(budget);
  const preCheck = await checkNavigationTarget(run.url, navigationOptions);
  if (!preCheck.allowed) {
    const reason = `unsafe_target:${preCheck.reason ?? 'blocked'}`;
    await recordStep(session.id, 'navigate', 'blocked', null, run.url, reason);
    throw new UnsafeTargetError(reason);
  }

  try {
    // The session watchdog owns the wall-clock deadline so callers always receive the typed
    // SessionLimitExceededError instead of a race-dependent Playwright TimeoutError.
    await page.goto(run.url, { waitUntil: 'load', timeout: 0 });
  } catch (error) {
    const blocked = getBlockedRequest();
    if (blocked) {
      const reason = `unsafe_target:${blocked.reason}`;
      await recordStep(session.id, 'navigate', 'blocked', null, blocked.url, reason);
      throw new UnsafeTargetError(reason, { cause: error });
    }
    throw error;
  }
  await throwIfBlocked();
  await recordStep(session.id, 'navigate', 'success', null, page.url(), null);

  consumeAction(budget);
  await captureScreenshot(session.id, page);
  await throwIfBlocked();

  consumeAction(budget);
  const urlBeforeClick = page.url();
  try {
    // The session watchdog owns the overall deadline; this is only the per-action ceiling.
    await page.locator('#subscribe-btn').click({ timeout: 5000 });
    await recordStep(session.id, 'click', 'success', urlBeforeClick, page.url(), null);
  } catch (error) {
    await recordStep(
      session.id,
      'click',
      'error',
      urlBeforeClick,
      page.url(),
      'subscribe button not found or not clickable',
    );
    throw error;
  }
  await throwIfBlocked();

  consumeAction(budget);
  await captureScreenshot(session.id, page);
  await throwIfBlocked();

  consumeAction(budget);
  await recordStep(session.id, 'finish', 'success', page.url(), page.url(), null);
}

/** Runs navigate -> capture -> click -> capture -> finish in a fresh context. */
export async function runFixedSessionScript(options: RunSessionOptions): Promise<void> {
  const { run, session, navigationOptions } = options;
  const budget: SessionBudget = {
    actions: 0,
    maxActions: run.limits.maxActionsPerSession,
    deadlineAt: Date.now() + run.limits.maxSessionSeconds * 1000,
  };

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const monitorController = new AbortController();
  let actionPromise: Promise<void> | null = null;
  let monitorPromise: Promise<never> | null = null;

  try {
    const resolverRules = await browserResolverRules(navigationOptions);
    browser = await chromium.launch({
      headless: true,
      timeout: Math.min(10_000, remainingMs(budget)),
      // A single context plus a renderer-process ceiling prevents a fixture session from fanning
      // out browser resources. Hard platform quotas belong to the eventual worker deployment.
      args: [
        '--renderer-process-limit=2',
        '--js-flags=--max-old-space-size=256',
        '--disable-background-networking',
        ...resolverRules,
      ],
    });
    activeBrowserCount += 1;
    context = await browser.newContext({
      acceptDownloads: false,
      viewport: {
        width: session.device.viewportWidth,
        height: session.device.viewportHeight,
      },
      userAgent: session.device.userAgent,
      reducedMotion: session.device.reducedMotion ? 'reduce' : 'no-preference',
    });

    let blockedRequest: BlockedRequest | null = null;
    const onBlocked = (blocked: BlockedRequest) => {
      blockedRequest ??= blocked;
    };
    await installNavigationGuard(context, navigationOptions, onBlocked);
    context.on('page', (newPage) => {
      newPage.on('download', (download) => rejectDownload(download, onBlocked));
    });
    const page = await context.newPage();
    page.on('download', (download) => rejectDownload(download, onBlocked));
    page.setDefaultTimeout(remainingMs(budget));
    page.setDefaultNavigationTimeout(0);

    actionPromise = executeFixedActions(
      page,
      run,
      session,
      budget,
      navigationOptions,
      () => blockedRequest,
    );
    monitorPromise = monitorSession(budget, options, monitorController.signal);
    await Promise.race([actionPromise, monitorPromise]);
  } finally {
    monitorController.abort();
    if (browser) {
      // Closing a context waits for an in-flight route handler. Terminate the owning browser
      // first so cancellation and hard limits also abort requests whose servers stopped
      // responding. browser.close() closes every context and page it owns.
      await browser.close().catch(() => undefined);
      activeBrowserCount -= 1;
    } else {
      await context?.close().catch(() => undefined);
    }
  }
}

async function observePage(page: Page): Promise<PageObservation & { screenshotBase64: string }> {
  const locator = page.locator(
    'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [role="link"], [role="textbox"]',
  );
  const count = Math.min(await locator.count(), 100);
  const elements: PageObservation['elements'] = [];
  for (let index = 0; index < count; index += 1) {
    const element = locator.nth(index);
    if (!(await element.isVisible().catch(() => false))) continue;
    const id = `nori-${index}`;
    const [tag, role, type, ariaLabel, placeholder, title, text, disabled] = await Promise.all([
      element.evaluate<string, string, HTMLElement>((node, elementId) => {
        node.setAttribute('data-nori-id', elementId);
        return node.tagName.toLowerCase();
      }, id),
      element.getAttribute('role'),
      element.getAttribute('type'),
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      element.getAttribute('title'),
      element.innerText().catch(() => ''),
      element.isDisabled().catch(() => false),
    ]);
    elements.push({
      id,
      tag,
      role,
      type,
      name: (ariaLabel || text || placeholder || title || type || tag).trim().slice(0, 300),
      disabled,
    });
  }
  const screenshot = await page.screenshot({ type: 'png' });
  return {
    url: page.url(),
    title: (await page.title()).slice(0, 500),
    visibleText: (await page.locator('body').innerText()).slice(0, 12_000),
    elements,
    screenshotBase64: screenshot.toString('base64'),
  };
}

async function executeAgentAction(
  action: BrowserAction,
  decisionObservation: string,
  page: Page,
  session: PersonaSession,
  budget: SessionBudget,
  getBlockedRequest: () => BlockedRequest | null,
): Promise<{ stepId: string; result: string }> {
  consumeAction(budget);
  const urlBefore = page.url();
  let step: Step | null = null;
  try {
    switch (action.kind) {
      case 'navigate':
        await page.goto(action.url, { waitUntil: 'load', timeout: 0 });
        break;
      case 'click':
        await page.locator(`[data-nori-id="${action.elementId}"]`).click({ timeout: 5000 });
        break;
      case 'scroll':
        await page.mouse.wheel(0, action.deltaY);
        break;
      case 'type':
        await page.locator(`[data-nori-id="${action.elementId}"]`).fill(action.text);
        break;
      case 'wait':
        await page.waitForTimeout(action.milliseconds);
        break;
      case 'capture':
      case 'finish':
        break;
    }

    const blocked = getBlockedRequest();
    if (blocked) throw new UnsafeTargetError(`unsafe_target:${blocked.reason}`);
    const observation =
      action.kind === 'finish'
        ? `${decisionObservation} ${action.summary}`.slice(0, 2000)
        : decisionObservation;
    step = await recordStep(session.id, action.kind, 'success', urlBefore, page.url(), observation);
    if (action.kind !== 'finish' && action.kind !== 'wait') {
      await attachScreenshot(session.id, step.id, page);
    }
    return { stepId: step.id, result: `success at ${page.url()}` };
  } catch (error) {
    if (!step) {
      await recordStep(
        session.id,
        action.kind,
        error instanceof UnsafeTargetError ? 'blocked' : 'error',
        urlBefore,
        page.url(),
        error instanceof Error ? error.message : String(error),
      );
    }
    throw error;
  }
}

async function executePersonaAgent(
  page: Page,
  options: RunPersonaSessionOptions,
  budget: SessionBudget,
  getBlockedRequest: () => BlockedRequest | null,
  signal: AbortSignal,
): Promise<AgentLoopResult> {
  consumeAction(budget);
  const preCheck = await checkNavigationTarget(options.run.url, options.navigationOptions);
  if (!preCheck.allowed) {
    const reason = `unsafe_target:${preCheck.reason ?? 'blocked'}`;
    await recordStep(options.session.id, 'navigate', 'blocked', null, options.run.url, reason);
    throw new UnsafeTargetError(reason);
  }
  try {
    await page.goto(options.run.url, { waitUntil: 'load', timeout: 0 });
  } catch (error) {
    const blockedTarget = getBlockedRequest();
    if (blockedTarget) {
      const reason = `unsafe_target:${blockedTarget.reason}`;
      await recordStep(options.session.id, 'navigate', 'blocked', null, blockedTarget.url, reason);
      throw new UnsafeTargetError(reason, { cause: error });
    }
    throw error;
  }
  const blocked = getBlockedRequest();
  if (blocked) {
    const reason = `unsafe_target:${blocked.reason}`;
    await recordStep(options.session.id, 'navigate', 'blocked', null, blocked.url, reason);
    throw new UnsafeTargetError(reason);
  }
  const initialStep = await recordStep(
    options.session.id,
    'navigate',
    'success',
    null,
    page.url(),
    'Opened the run start URL.',
  );
  await attachScreenshot(options.session.id, initialStep.id, page);

  const result = await runAgentLoop({
    persona: options.persona,
    task: options.run.task,
    model: options.model,
    navigationOptions: options.navigationOptions,
    maxActions: Math.max(0, budget.maxActions - budget.actions),
    hardCostCapUsd: Math.max(0, options.run.limits.hardCostCapUsd - options.run.costTotalUsd),
    onUsage: (usage) => addRunCost(options.run.id, usage.costUsd),
    signal,
    observe: () => observePage(page),
    execute: (action, observation) =>
      executeAgentAction(action, observation, page, options.session, budget, getBlockedRequest),
  });
  return { ...result, evidenceStepIds: [initialStep.id, ...result.evidenceStepIds] };
}

/** Runs a model-selected but policy-validated persona loop in a fresh browser context. */
export async function runPersonaAgentSession(
  options: RunPersonaSessionOptions,
): Promise<AgentLoopResult> {
  const budget: SessionBudget = {
    actions: 0,
    maxActions: options.run.limits.maxActionsPerSession,
    deadlineAt: Date.now() + options.run.limits.maxSessionSeconds * 1000,
  };
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const monitorController = new AbortController();
  try {
    const resolverRules = await browserResolverRules(options.navigationOptions);
    browser = await chromium.launch({
      headless: true,
      timeout: Math.min(10_000, remainingMs(budget)),
      args: [
        '--renderer-process-limit=2',
        '--js-flags=--max-old-space-size=256',
        '--disable-background-networking',
        ...resolverRules,
      ],
    });
    activeBrowserCount += 1;
    context = await browser.newContext({
      acceptDownloads: false,
      viewport: {
        width: options.session.device.viewportWidth,
        height: options.session.device.viewportHeight,
      },
      userAgent: options.session.device.userAgent,
      reducedMotion: options.session.device.reducedMotion ? 'reduce' : 'no-preference',
    });
    let blockedRequest: BlockedRequest | null = null;
    const onBlocked = (blockedTarget: BlockedRequest) => {
      blockedRequest ??= blockedTarget;
    };
    await installNavigationGuard(context, options.navigationOptions, onBlocked);
    context.on('page', (newPage) => {
      newPage.on('download', (download) => rejectDownload(download, onBlocked));
    });
    const page = await context.newPage();
    page.on('download', (download) => rejectDownload(download, onBlocked));
    page.setDefaultTimeout(remainingMs(budget));
    page.setDefaultNavigationTimeout(0);

    return await Promise.race([
      executePersonaAgent(page, options, budget, () => blockedRequest, monitorController.signal),
      monitorSession(budget, options, monitorController.signal),
    ]);
  } finally {
    monitorController.abort();
    if (browser) {
      await browser.close().catch(() => undefined);
      activeBrowserCount -= 1;
    } else {
      await context?.close().catch(() => undefined);
    }
  }
}
