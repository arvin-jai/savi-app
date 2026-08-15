import { buildBalanceTrend, normalisePoints, trendChangePercent } from './trend';

const TODAY = '2026-08-15';

describe('buildBalanceTrend', () => {
  it('records today at the current balance, not the balance minus today', () => {
    // The off-by-one: today's closing balance ALREADY includes today's
    // movements, so unwinding them for today's own point is wrong.
    const points = buildBalanceTrend(100_000, [{ date: TODAY, netMinor: 30_000 }], 3, TODAY);

    expect(points[points.length - 1]).toEqual({ date: TODAY, balanceMinor: 100_000 });
  });

  it('walks backwards, unwinding each day', () => {
    const points = buildBalanceTrend(
      100_000,
      [
        { date: '2026-08-15', netMinor: 10_000 }, // today: +100
        { date: '2026-08-14', netMinor: -5_000 }, // yesterday: −50
      ],
      3,
      TODAY
    );

    expect(points).toEqual([
      { date: '2026-08-13', balanceMinor: 95_000 }, // 90,000 + 5,000
      { date: '2026-08-14', balanceMinor: 90_000 }, // 100,000 − 10,000
      { date: '2026-08-15', balanceMinor: 100_000 },
    ]);
  });

  it('returns points oldest-first, because charts read left to right', () => {
    const points = buildBalanceTrend(0, [], 5, TODAY);
    const dates = points.map((p) => p.date);

    expect(dates).toEqual([...dates].sort());
    expect(dates[dates.length - 1]).toBe(TODAY);
  });

  it('treats days with no movement as flat', () => {
    const points = buildBalanceTrend(50_000, [], 4, TODAY);
    expect(points.every((p) => p.balanceMinor === 50_000)).toBe(true);
  });

  it('produces exactly the requested number of points', () => {
    expect(buildBalanceTrend(0, [], 14, TODAY)).toHaveLength(14);
    expect(buildBalanceTrend(0, [], 1, TODAY)).toHaveLength(1);
  });

  it('crosses a month boundary without repeating or skipping a date', () => {
    const points = buildBalanceTrend(0, [], 4, '2026-09-02');
    expect(points.map((p) => p.date)).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('handles a balance that was negative in the past', () => {
    // An overdraft is a real state; the line must show it rather than clamping.
    const points = buildBalanceTrend(10_000, [{ date: TODAY, netMinor: 60_000 }], 2, TODAY);
    expect(points[0].balanceMinor).toBe(-50_000);
  });
});

describe('trendChangePercent', () => {
  const series = (values: number[]) =>
    values.map((v, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, balanceMinor: v }));

  it('compares the latest point with the one N days back', () => {
    // 100 → 108 over 7 days = +8%
    expect(trendChangePercent(series([100, 0, 0, 0, 0, 0, 0, 108]), 7)).toBe(8);
  });

  it('reports a fall as negative', () => {
    expect(trendChangePercent(series([200, 0, 0, 0, 0, 0, 0, 150]), 7)).toBe(-25);
  });

  it('returns null when there are not enough points', () => {
    expect(trendChangePercent(series([100, 110]), 7)).toBeNull();
  });

  it('returns null on a zero or negative baseline', () => {
    // "+200%" from −₱100 to ₱100 is arithmetic, not information.
    expect(trendChangePercent(series([0, 0, 0, 0, 0, 0, 0, 100]), 7)).toBeNull();
    expect(trendChangePercent(series([-100, 0, 0, 0, 0, 0, 0, 100]), 7)).toBeNull();
  });

  it('reports zero for no change rather than null', () => {
    expect(trendChangePercent(series([100, 0, 0, 0, 0, 0, 0, 100]), 7)).toBe(0);
  });
});

describe('normalisePoints', () => {
  it('maps the lowest point to 0 and the highest to 1', () => {
    const out = normalisePoints([
      { date: 'a', balanceMinor: 100 },
      { date: 'b', balanceMinor: 200 },
      { date: 'c', balanceMinor: 300 },
    ]);
    expect(out).toEqual([0, 0.5, 1]);
  });

  it('draws a flat series through the middle instead of dividing by zero', () => {
    const out = normalisePoints([
      { date: 'a', balanceMinor: 50 },
      { date: 'b', balanceMinor: 50 },
    ]);
    expect(out).toEqual([0.5, 0.5]);
    expect(out.every(Number.isFinite)).toBe(true);
  });

  it('handles negative balances', () => {
    const out = normalisePoints([
      { date: 'a', balanceMinor: -100 },
      { date: 'b', balanceMinor: 100 },
    ]);
    expect(out).toEqual([0, 1]);
  });

  it('returns nothing for an empty series', () => {
    expect(normalisePoints([])).toEqual([]);
  });
});
