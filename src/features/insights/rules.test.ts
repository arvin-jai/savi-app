import type { BillWithStatus } from '@/features/bills/api';
import type { FinancialSummary } from '@/lib/database.types';

import { computeInsight, type InsightInputs } from './rules';

function summary(patch: Partial<FinancialSummary> = {}): FinancialSummary {
  return {
    total_income_minor: 3_000_000,
    total_expenses_minor: 500_000,
    remaining_minor: 2_500_000,
    upcoming_bills_minor: 169_900,
    current_balance_minor: 2_500_000,
    available_money_minor: 2_330_100,
    ...patch,
  };
}

function bill(patch: Partial<BillWithStatus>): BillWithStatus {
  return {
    id: 'b1',
    user_id: 'u1',
    name: 'Internet',
    amount_minor: 169_900,
    currency: 'PHP',
    recurrence: 'monthly',
    interval_months: 1,
    anchor_month: null,
    due_day: 15,
    category_id: null,
    account_id: null,
    archived_at: null,
    created_at: '',
    updated_at: '',
    dueDate: '2026-08-15',
    status: 'upcoming',
    payment: null,
    ...patch,
  };
}

function inputs(patch: Partial<InsightInputs> = {}): InsightInputs {
  return {
    summary: summary(),
    bills: [],
    categorySpend: [],
    recurringIncomeMinor: null,
    transactionCount: 50,
    today: '2026-08-14',
    ...patch,
  };
}

describe('priority order', () => {
  it('negative available money outranks everything', () => {
    const result = computeInsight(
      inputs({
        summary: summary({ available_money_minor: -130_000 }),
        bills: [bill({ status: 'overdue', dueDate: '2026-08-10' })],
        categorySpend: [
          { slug: 'food', name: 'Food', currentMinor: 500_000, previousMinor: 100_000 },
        ],
      })
    );
    expect(result?.id).toBe('cash-flow');
    // The amount is stated plainly — ₱1,300 short.
    expect(result?.headline).toContain('₱1,300');
    expect(result?.tone).toBe('attention');
  });

  it('overdue bills outrank due-soon and spending', () => {
    const result = computeInsight(
      inputs({
        bills: [
          bill({ id: 'a', status: 'due-soon', dueDate: '2026-08-15' }),
          bill({ id: 'b', name: 'Meralco', status: 'overdue', dueDate: '2026-08-10' }),
        ],
      })
    );
    expect(result?.id).toBe('overdue-b');
    expect(result?.headline).toContain('Meralco');
  });
});

describe('bill due soon', () => {
  it('phrases today / tomorrow / in N days', () => {
    const today = '2026-08-14';
    expect(
      computeInsight(inputs({ bills: [bill({ status: 'due-soon', dueDate: '2026-08-14' })], today }))
        ?.headline
    ).toContain('due today');
    expect(
      computeInsight(inputs({ bills: [bill({ status: 'due-soon', dueDate: '2026-08-15' })], today }))
        ?.headline
    ).toContain('due tomorrow');
    expect(
      computeInsight(inputs({ bills: [bill({ status: 'due-soon', dueDate: '2026-08-16' })], today }))
        ?.headline
    ).toContain('due in 2 days');
  });

  it('includes the amount, because that is what the user acts on', () => {
    const result = computeInsight(
      inputs({ bills: [bill({ status: 'due-soon', dueDate: '2026-08-15' })] })
    );
    expect(result?.headline).toContain('₱1,699');
  });

  it('counts multiple overdue bills instead of naming just one', () => {
    const result = computeInsight(
      inputs({
        bills: [
          bill({ id: 'a', status: 'overdue' }),
          bill({ id: 'b', status: 'overdue' }),
        ],
      })
    );
    expect(result?.headline).toContain('2 bills');
  });
});

describe('spending change', () => {
  it('reports the biggest mover with a percentage', () => {
    const result = computeInsight(
      inputs({
        categorySpend: [
          { slug: 'food', name: 'Food', currentMinor: 124_000, previousMinor: 100_000 },
          { slug: 'transport', name: 'Transport', currentMinor: 200_000, previousMinor: 100_000 },
        ],
      })
    );
    // Transport doubled; food rose 24%. Transport wins.
    expect(result?.id).toBe('spend-transport-up');
    expect(result?.headline).toContain('100% higher');
    expect(result?.headline).toContain('this time last month');
  });

  it('ignores swings below 20%', () => {
    const result = computeInsight(
      inputs({
        categorySpend: [
          { slug: 'food', name: 'Food', currentMinor: 119_000, previousMinor: 100_000 },
        ],
      })
    );
    expect(result?.id).not.toBe('spend-food-up');
  });

  it('ignores large ratios on tiny bases — "300% more" on ₱60 is noise', () => {
    const result = computeInsight(
      inputs({
        categorySpend: [
          { slug: 'food', name: 'Food', currentMinor: 24_000, previousMinor: 6_000 },
        ],
      })
    );
    expect(result?.id).not.toBe('spend-food-up');
  });

  it('celebrates a drop with a positive tone', () => {
    const result = computeInsight(
      inputs({
        categorySpend: [
          { slug: 'food', name: 'Food', currentMinor: 60_000, previousMinor: 100_000 },
        ],
      })
    );
    expect(result?.id).toBe('spend-food-down');
    expect(result?.tone).toBe('positive');
  });
});

describe('welcome insight (P§34)', () => {
  it('fires for a near-empty ledger with recurring income', () => {
    const result = computeInsight(
      inputs({
        transactionCount: 2,
        recurringIncomeMinor: 3_000_000,
        bills: [bill({}), bill({ id: 'b2', name: 'Rent', amount_minor: 800_000 })],
        summary: null,
      })
    );
    expect(result?.id).toBe('welcome');
    // 30,000 − (1,699 + 8,000) = 20,301
    expect(result?.headline).toContain('₱20,301');
  });

  it('stays calm when bills nearly consume income', () => {
    const result = computeInsight(
      inputs({
        transactionCount: 0,
        recurringIncomeMinor: 1_000_000,
        bills: [bill({ amount_minor: 1_100_000 })],
        summary: null,
      })
    );
    expect(result?.id).toBe('welcome-tight');
    expect(result?.tone).toBe('calm');
    // D§63: no alarm words.
    expect(result?.headline).not.toMatch(/warning|!{2,}/i);
  });

  it('retires once real usage exists', () => {
    const result = computeInsight(
      inputs({ transactionCount: 20, recurringIncomeMinor: 3_000_000, summary: null })
    );
    expect(result).toBeNull();
  });
});

describe('quiet encouragement (D§64)', () => {
  it('notes income kept, with the percentage', () => {
    const result = computeInsight(inputs());
    expect(result?.id).toBe('kept');
    expect(result?.headline).toContain('₱25,000');
    expect(result?.detail).toContain('83%');
  });

  it('says nothing rather than forcing cheer', () => {
    expect(
      computeInsight(
        inputs({ summary: summary({ total_income_minor: 0, remaining_minor: 0 }) })
      )
    ).toBeNull();
    expect(
      computeInsight(
        inputs({
          summary: summary({ remaining_minor: -50_000 }),
        })
      )
    ).toBeNull();
  });
});
