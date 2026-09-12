/*
 * Consolidates the prototype's scattered fixture-mode disclaimers (`.sample-badge` in the
 * header, plus ad hoc copy like "Simulated browser frames...", "Illustrative finding, not a
 * test result...", "Creates a local sample run only...") into one reusable component with two
 * variants (see plan/PHASE_2_PLAN.md section 8):
 *
 * - `badge` — compact inline badge, replacing `.sample-badge` in the workspace header.
 * - `disclaimer` — longer disclaimer text, for dialogs/footers/panel captions.
 *
 * Consistent use here is what makes it trivial for Phase 3+ to turn fixture mode off once real
 * runs exist, without hunting down five separately worded copies of the same disclaimer.
 */

export type FixtureModeBadgeVariant = 'badge' | 'disclaimer';

export interface FixtureModeBadgeProps {
  variant?: FixtureModeBadgeVariant;
  /**
   * Overrides the default copy for this variant — used where the prototype's disclaimer wording
   * differs by context (e.g. "Creates a local sample run only..." vs "Illustrative finding...").
   */
  children?: string;
  className?: string;
}

const DEFAULT_BADGE_TEXT = 'Sample workspace';
const DEFAULT_DISCLAIMER_TEXT =
  'Illustrative data — a fictional sample workspace, not a live connection to any real website.';

export function FixtureModeBadge({ variant = 'badge', children, className }: FixtureModeBadgeProps) {
  if (variant === 'disclaimer') {
    return <p className={className ?? 'disclaimer'}>{children ?? DEFAULT_DISCLAIMER_TEXT}</p>;
  }

  return <span className={className ?? 'sample-badge'}>{children ?? DEFAULT_BADGE_TEXT}</span>;
}
