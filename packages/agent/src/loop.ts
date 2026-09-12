import type {
  BrowserAction,
  ModelUsage,
  PageObservation,
  Persona,
  PersonaReportOutcome,
} from '@nori/contracts';
import type { NavigationCheckOptions } from './safe-navigation';
import { validateBrowserAction } from './action-policy';
import type { ActionHistoryItem, PersonaActionModel } from './model';

export class AgentLoopError extends Error {}
export class AgentCostLimitError extends AgentLoopError {}
export class AgentRepeatedActionError extends AgentLoopError {}
export class AgentInvalidActionError extends AgentLoopError {}

export interface AgentObservation extends PageObservation {
  screenshotBase64?: string;
}

export interface ActionExecutionResult {
  stepId: string;
  result: string;
}

export interface AgentLoopResult {
  outcome: PersonaReportOutcome;
  summary: string;
  evidenceStepIds: string[];
  usage: ModelUsage;
}

export interface RunAgentLoopOptions {
  persona: Persona;
  task: string;
  model: PersonaActionModel;
  navigationOptions: NavigationCheckOptions;
  maxActions: number;
  hardCostCapUsd: number;
  observe: () => Promise<AgentObservation>;
  execute: (action: BrowserAction, decisionObservation: string) => Promise<ActionExecutionResult>;
  onUsage?: (usage: ModelUsage) => Promise<void>;
  signal?: AbortSignal;
}

function actionSignature(action: BrowserAction, url: string): string {
  return `${url}:${JSON.stringify(action)}`;
}

export async function runAgentLoop(options: RunAgentLoopOptions): Promise<AgentLoopResult> {
  const history: ActionHistoryItem[] = [];
  const signatures = new Map<string, number>();
  const evidenceStepIds: string[] = [];
  const usage: ModelUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  for (let actionCount = 0; actionCount < options.maxActions; actionCount += 1) {
    options.signal?.throwIfAborted();
    const observation = await options.observe();
    const selection = await options.model.selectAction({
      persona: options.persona,
      task: options.task,
      observation,
      history,
      screenshotBase64: observation.screenshotBase64,
      signal: options.signal,
    });
    usage.inputTokens += selection.usage.inputTokens;
    usage.outputTokens += selection.usage.outputTokens;
    usage.costUsd += selection.usage.costUsd;
    await options.onUsage?.(selection.usage);
    if (usage.costUsd > options.hardCostCapUsd) {
      throw new AgentCostLimitError(
        `model cost $${usage.costUsd.toFixed(4)} exceeded cap $${options.hardCostCapUsd.toFixed(4)}`,
      );
    }

    const validation = await validateBrowserAction(
      selection.decision.action,
      observation,
      options.navigationOptions,
    );
    if (!validation.allowed) {
      throw new AgentInvalidActionError(`blocked model action: ${validation.reason ?? 'unknown'}`);
    }

    const signature = actionSignature(selection.decision.action, observation.url);
    const repeats = (signatures.get(signature) ?? 0) + 1;
    signatures.set(signature, repeats);
    if (repeats >= 3) {
      throw new AgentRepeatedActionError(
        `model repeated the same action three times: ${signature}`,
      );
    }

    const execution = await options.execute(
      selection.decision.action,
      selection.decision.observation,
    );
    evidenceStepIds.push(execution.stepId);
    history.push({ action: selection.decision.action, result: execution.result });

    if (selection.decision.action.kind === 'finish') {
      return {
        outcome: selection.decision.action.outcome,
        summary: selection.decision.action.summary,
        evidenceStepIds,
        usage,
      };
    }
  }

  return {
    outcome: 'task_failure',
    summary: `The persona stopped after reaching the ${options.maxActions}-action limit.`,
    evidenceStepIds,
    usage,
  };
}
