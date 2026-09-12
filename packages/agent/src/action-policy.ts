import { browserActionSchema, type BrowserAction, type PageObservation } from '@nori/contracts';
import { checkNavigationTarget, type NavigationCheckOptions } from './safe-navigation';

export interface ActionValidationResult {
  allowed: boolean;
  reason?: string;
}

export async function validateBrowserAction(
  candidate: unknown,
  observation: PageObservation,
  navigationOptions: NavigationCheckOptions,
): Promise<ActionValidationResult> {
  const parsed = browserActionSchema.safeParse(candidate);
  if (!parsed.success) return { allowed: false, reason: 'invalid_action_schema' };
  const action: BrowserAction = parsed.data;

  if (action.kind === 'navigate') {
    return checkNavigationTarget(action.url, navigationOptions);
  }

  if (action.kind === 'click' || action.kind === 'type') {
    const element = observation.elements.find((item) => item.id === action.elementId);
    if (!element) return { allowed: false, reason: 'element_not_in_current_observation' };
    if (element.disabled) return { allowed: false, reason: 'element_disabled' };
    if (action.kind === 'type') {
      const inputType = element.type?.toLowerCase();
      const canType =
        element.tag === 'textarea' ||
        element.role === 'textbox' ||
        (element.tag === 'input' &&
          !['button', 'submit', 'checkbox', 'radio'].includes(inputType ?? ''));
      if (!canType) return { allowed: false, reason: 'element_not_text_input' };
      if (inputType === 'password' || inputType === 'file' || inputType === 'hidden') {
        return { allowed: false, reason: `input_type_blocked:${inputType}` };
      }
    }
  }

  return { allowed: true };
}
