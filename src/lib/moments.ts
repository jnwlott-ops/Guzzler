/**
 * The moments worth interrupting a driver for.
 *
 * Guzzler plans, the driver executes in their own nav app, and we speak at key
 * moments. This file is the definition of "key" — deliberately a short, closed
 * list rather than an open notification API, because the failure mode of a
 * companion app is obvious and fatal: notify too often, get muted, and every
 * feature that depends on notifications dies at once.
 *
 * The bar: a moment earns an interruption only if it is **time-critical** (the
 * driver passes the decision point soon) and **materially valuable** (real
 * money, or a problem avoided). Anything failing either test belongs in the app
 * for them to find, not on their lock screen.
 */

export type MomentKind =
  /** They left a stop; the next leg is ready to hand off. */
  | 'next-leg'
  /** A saved place is coming up. */
  | 'favorite-ahead'
  /** Something cheaper appeared ahead of their planned stop. */
  | 'better-deal-ahead'
  /** Long stretch with no fuel after this — take it or commit to the gap. */
  | 'last-chance'
  /** Range is running down and the planned stop is still far off. */
  | 'range-warning';

/**
 * How hard a moment is allowed to push.
 *
 * `critical` may interrupt regardless of budget — running dry is not a
 * preference. Everything else competes for a limited number of interruptions.
 */
export type MomentPriority = 'critical' | 'high' | 'normal';

export interface MomentRule {
  kind: MomentKind;
  priority: MomentPriority;
  /** Why this is allowed to interrupt someone who is driving. */
  rationale: string;
  /** Minimum minutes between two notifications of this kind. */
  cooldownMinutes: number;
}

export const MOMENT_RULES: Record<MomentKind, MomentRule> = {
  'range-warning': {
    kind: 'range-warning',
    priority: 'critical',
    rationale:
      'Running out of fuel is the one failure the driver cannot undo from the shoulder. ' +
      'Always allowed through.',
    cooldownMinutes: 20,
  },
  'last-chance': {
    kind: 'last-chance',
    priority: 'critical',
    rationale:
      'A long gap with no fuel is information that expires at a specific point on the road. ' +
      'Said late, it is useless; said once, it prevents a stranding.',
    cooldownMinutes: 60,
  },
  'next-leg': {
    kind: 'next-leg',
    priority: 'high',
    rationale:
      'The driver just left a stop and their nav has nowhere to go next. This is the relay ' +
      'that makes plan/execute/notify work at all.',
    cooldownMinutes: 5,
  },
  'favorite-ahead': {
    kind: 'favorite-ahead',
    priority: 'high',
    rationale:
      'They explicitly saved this place, and the exit passes in about two minutes. Asked for, ' +
      'and expires.',
    cooldownMinutes: 30,
  },
  'better-deal-ahead': {
    kind: 'better-deal-ahead',
    priority: 'normal',
    rationale:
      'Real money, but only worth an interruption when the saving is large enough to justify ' +
      'one. Gated on the same dollar floor as the map banner.',
    cooldownMinutes: 45,
  },
};

/**
 * Non-critical interruptions allowed per hour of driving.
 *
 * Three is not a tuned number — it's a deliberate ceiling chosen because an app
 * that speaks more often than roughly once every twenty minutes reads as
 * chatty, and chatty companions get muted. Revisit it against real usage, not
 * intuition.
 */
export const HOURLY_INTERRUPTION_BUDGET = 3;

/** Minimum savings before a deal is worth a notification, in dollars. */
export const DEAL_NOTIFICATION_FLOOR = 3;

export interface MomentCandidate {
  kind: MomentKind;
  /** When this moment became true. */
  at: number;
}

export interface BudgetState {
  /** Timestamps of non-critical notifications already sent, newest last. */
  recentSends: number[];
  /** Last send time per kind, for cooldowns. */
  lastByKind: Partial<Record<MomentKind, number>>;
}

/**
 * Decides whether a moment may interrupt right now.
 *
 * Critical moments bypass the hourly budget but still respect their own
 * cooldown — a range warning every thirty seconds is noise even when the
 * underlying fact is urgent.
 */
export function shouldNotify(
  candidate: MomentCandidate,
  budget: BudgetState,
  now: number = Date.now(),
): boolean {
  const rule = MOMENT_RULES[candidate.kind];

  const lastOfKind = budget.lastByKind[candidate.kind];
  if (lastOfKind !== undefined && now - lastOfKind < rule.cooldownMinutes * 60_000) {
    return false;
  }

  if (rule.priority === 'critical') return true;

  const oneHourAgo = now - 60 * 60_000;
  const recent = budget.recentSends.filter((t) => t > oneHourAgo);
  return recent.length < HOURLY_INTERRUPTION_BUDGET;
}

/** Records a send, so cooldowns and the budget reflect it. */
export function recordSend(
  kind: MomentKind,
  budget: BudgetState,
  now: number = Date.now(),
): BudgetState {
  const isCritical = MOMENT_RULES[kind].priority === 'critical';

  return {
    // Critical sends don't consume the budget, matching shouldNotify.
    recentSends: isCritical
      ? budget.recentSends
      : [...budget.recentSends.filter((t) => t > now - 60 * 60_000), now],
    lastByKind: { ...budget.lastByKind, [kind]: now },
  };
}

export const EMPTY_BUDGET: BudgetState = { recentSends: [], lastByKind: {} };
