import {
  EMPTY_BUDGET,
  HOURLY_INTERRUPTION_BUDGET,
  MOMENT_RULES,
  recordSend,
  shouldNotify,
  type BudgetState,
  type MomentKind,
} from '../moments';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

const kinds = Object.keys(MOMENT_RULES) as MomentKind[];

describe('moment rules', () => {
  it('documents why every moment may interrupt a driver', () => {
    for (const kind of kinds) {
      const rule = MOMENT_RULES[kind];
      expect(rule.rationale.length).toBeGreaterThan(20);
      expect(rule.cooldownMinutes).toBeGreaterThan(0);
    }
  });

  it('reserves critical only for outcomes the driver cannot undo', () => {
    // Running dry and a long gap with no fuel. Everything else is a preference,
    // however valuable, and competes for the budget.
    const critical = kinds.filter((k) => MOMENT_RULES[k].priority === 'critical');
    expect(critical.sort()).toEqual(['last-chance', 'range-warning']);
  });
});

describe('shouldNotify', () => {
  it('allows a moment when nothing has been sent', () => {
    for (const kind of kinds) {
      expect(shouldNotify({ kind, at: NOW }, EMPTY_BUDGET, NOW)).toBe(true);
    }
  });

  it('honours each kind cooldown', () => {
    for (const kind of kinds) {
      const rule = MOMENT_RULES[kind];
      const budget: BudgetState = { recentSends: [], lastByKind: { [kind]: NOW } };

      const justInside = NOW + rule.cooldownMinutes * MINUTE - 1000;
      const justOutside = NOW + rule.cooldownMinutes * MINUTE + 1000;

      expect(shouldNotify({ kind, at: justInside }, budget, justInside)).toBe(false);
      expect(shouldNotify({ kind, at: justOutside }, budget, justOutside)).toBe(true);
    }
  });

  it('cools down critical moments too', () => {
    // A range warning every thirty seconds is noise even when the fact is real.
    const budget: BudgetState = { recentSends: [], lastByKind: { 'range-warning': NOW } };
    expect(shouldNotify({ kind: 'range-warning', at: NOW + MINUTE }, budget, NOW + MINUTE)).toBe(
      false,
    );
  });

  describe('hourly budget', () => {
    const spent: BudgetState = {
      recentSends: Array.from({ length: HOURLY_INTERRUPTION_BUDGET }, (_, i) => NOW - i * MINUTE),
      lastByKind: {},
    };

    it('stops non-critical moments once the budget is spent', () => {
      // The failure mode this exists to prevent: notify too often, get muted,
      // and every notification-dependent feature dies at once.
      expect(shouldNotify({ kind: 'better-deal-ahead', at: NOW }, spent, NOW)).toBe(false);
      expect(shouldNotify({ kind: 'favorite-ahead', at: NOW }, spent, NOW)).toBe(false);
      expect(shouldNotify({ kind: 'next-leg', at: NOW }, spent, NOW)).toBe(false);
    });

    it('lets critical moments through a spent budget', () => {
      expect(shouldNotify({ kind: 'range-warning', at: NOW }, spent, NOW)).toBe(true);
      expect(shouldNotify({ kind: 'last-chance', at: NOW }, spent, NOW)).toBe(true);
    });

    it('frees the budget as sends age past an hour', () => {
      const old: BudgetState = {
        recentSends: spent.recentSends.map((t) => t - 61 * MINUTE),
        lastByKind: {},
      };
      expect(shouldNotify({ kind: 'better-deal-ahead', at: NOW }, old, NOW)).toBe(true);
    });
  });
});

describe('recordSend', () => {
  it('spends budget for non-critical moments', () => {
    const after = recordSend('favorite-ahead', EMPTY_BUDGET, NOW);
    expect(after.recentSends).toHaveLength(1);
    expect(after.lastByKind['favorite-ahead']).toBe(NOW);
  });

  it('does not spend budget for critical moments', () => {
    // Matches shouldNotify: critical bypasses the budget, so it must not
    // consume it either, or a range warning would silence later deals.
    const after = recordSend('range-warning', EMPTY_BUDGET, NOW);
    expect(after.recentSends).toHaveLength(0);
    expect(after.lastByKind['range-warning']).toBe(NOW);
  });

  it('drops sends older than an hour', () => {
    const stale: BudgetState = { recentSends: [NOW - 90 * MINUTE], lastByKind: {} };
    expect(recordSend('next-leg', stale, NOW).recentSends).toEqual([NOW]);
  });

  it('enforces the budget across a realistic drive', () => {
    let budget = EMPTY_BUDGET;
    let sent = 0;

    // Ten deal-ish moments over an hour; only the budget should get through,
    // and only the first, since the cooldown is longer than the spacing.
    for (let i = 0; i < 10; i++) {
      const at = NOW + i * 6 * MINUTE;
      if (shouldNotify({ kind: 'better-deal-ahead', at }, budget, at)) {
        budget = recordSend('better-deal-ahead', budget, at);
        sent++;
      }
    }

    expect(sent).toBeLessThanOrEqual(HOURLY_INTERRUPTION_BUDGET);
    expect(sent).toBeGreaterThan(0);
  });
});
