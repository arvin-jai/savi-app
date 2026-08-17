import { spendCaption, startOfWeek, summariseSpend, type SpendRow } from './spend';

const fmt = (minor: number) => `P${(minor / 100).toFixed(2)}`;

function row(partial: Partial<SpendRow> & { transaction_date: string }): SpendRow {
  return {
    amount_minor: 10_000,
    direction: 'out',
    type: 'expense',
    ...partial,
  };
}

describe('startOfWeek', () => {
  // 2026-08-16 is a Sunday; 2026-08-10 is the Monday before it.
  it('returns the Monday of the same week', () => {
    expect(startOfWeek('2026-08-12')).toBe('2026-08-10'); // Wednesday
    expect(startOfWeek('2026-08-10')).toBe('2026-08-10'); // Monday itself
  });

  it('puts Sunday at the END of its week, not the start of the next', () => {
    expect(startOfWeek('2026-08-16')).toBe('2026-08-10');
  });

  it('crosses a month boundary', () => {
    expect(startOfWeek('2026-09-02')).toBe('2026-08-31');
  });

  it('crosses a year boundary', () => {
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });
});

describe('summariseSpend', () => {
  const TODAY = '2026-08-13'; // Thursday; week starts 2026-08-10

  it('sums money out for today and for the week', () => {
    const s = summariseSpend(
      [
        row({ transaction_date: TODAY, amount_minor: 25_000 }),
        row({ transaction_date: TODAY, amount_minor: 5_000 }),
        row({ transaction_date: '2026-08-11', amount_minor: 100_000 }),
      ],
      TODAY
    );

    expect(s.todayMinor).toBe(30_000);
    expect(s.weekMinor).toBe(130_000);
    expect(s.weekStart).toBe('2026-08-10');
  });

  it('excludes transfers structurally — moving money is not spending', () => {
    const s = summariseSpend(
      [
        row({ transaction_date: TODAY, amount_minor: 500_000, type: 'transfer' }),
        row({ transaction_date: TODAY, amount_minor: 1_000 }),
      ],
      TODAY
    );

    expect(s.todayMinor).toBe(1_000);
    expect(s.weekMinor).toBe(1_000);
  });

  it('excludes income', () => {
    const s = summariseSpend(
      [
        row({ transaction_date: TODAY, direction: 'in', type: 'income', amount_minor: 900_000 }),
        row({ transaction_date: TODAY, amount_minor: 2_000 }),
      ],
      TODAY
    );

    expect(s.weekMinor).toBe(2_000);
  });

  it('does NOT net a refund off the spend (M13)', () => {
    // A refund is income. Netting would make this line disagree with the
    // transaction list, which is the exact defect M13 recorded.
    const s = summariseSpend(
      [
        row({ transaction_date: TODAY, amount_minor: 150_000 }),
        row({ transaction_date: TODAY, direction: 'in', type: 'refund', amount_minor: 150_000 }),
      ],
      TODAY
    );

    expect(s.weekMinor).toBe(150_000);
  });

  it('ignores anything before the week start', () => {
    const s = summariseSpend(
      [row({ transaction_date: '2026-08-09', amount_minor: 999_999 })],
      TODAY
    );

    expect(s.weekMinor).toBe(0);
  });

  it('ignores future-dated rows', () => {
    const s = summariseSpend([row({ transaction_date: '2026-08-15' })], TODAY);
    expect(s.weekMinor).toBe(0);
  });

  it('is zero for an empty ledger rather than NaN', () => {
    const s = summariseSpend([], TODAY);
    expect(s.todayMinor).toBe(0);
    expect(s.weekMinor).toBe(0);
  });
});

describe('spendCaption', () => {
  it('says nothing at all when nothing was spent', () => {
    expect(spendCaption({ todayMinor: 0, weekMinor: 0, weekStart: '2026-08-10' }, fmt)).toBeNull();
  });

  it('reports the week alone when today is quiet', () => {
    expect(spendCaption({ todayMinor: 0, weekMinor: 45_000, weekStart: '2026-08-10' }, fmt)).toBe(
      'P450.00 spent this week'
    );
  });

  it('leads with today when there is a today', () => {
    expect(
      spendCaption({ todayMinor: 12_000, weekMinor: 45_000, weekStart: '2026-08-10' }, fmt)
    ).toBe('P120.00 spent today · P450.00 this week');
  });
});
