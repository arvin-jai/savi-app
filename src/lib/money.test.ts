import {
  formatMoney,
  parseMoney,
  sumMinor,
  toMinor,
  toMajor,
  currencySymbol,
} from './money';

describe('formatMoney', () => {
  it('hides decimals when the minor part is zero', () => {
    expect(formatMoney(2450000)).toBe('₱24,500');
    expect(formatMoney(169900)).toBe('₱1,699');
  });

  it('shows decimals when the minor part is non-zero', () => {
    expect(formatMoney(169950)).toBe('₱1,699.50');
    expect(formatMoney(25075)).toBe('₱250.75');
  });

  it('pads a single-digit minor part', () => {
    expect(formatMoney(25005)).toBe('₱250.05');
  });

  it('groups thousands', () => {
    expect(formatMoney(123456789)).toBe('₱1,234,567.89');
    expect(formatMoney(100000)).toBe('₱1,000');
  });

  it('renders zero', () => {
    expect(formatMoney(0)).toBe('₱0');
  });

  describe('sign display', () => {
    it('shows a minus by default', () => {
      expect(formatMoney(-25000)).toBe('-₱250');
    });

    it('shows both signs when asked — D§32 transaction rows', () => {
      expect(formatMoney(3000000, { signDisplay: 'always' })).toBe('+₱30,000');
      expect(formatMoney(-25000, { signDisplay: 'always' })).toBe('-₱250');
    });

    it('suppresses the sign for balances', () => {
      expect(formatMoney(-25000, { signDisplay: 'never' })).toBe('₱250');
    });
  });

  describe('decimals option', () => {
    it('always shows two when forced', () => {
      expect(formatMoney(169900, { decimals: 'always' })).toBe('₱1,699.00');
    });

    it('rounds to the major unit when suppressed', () => {
      expect(formatMoney(169950, { decimals: 'never' })).toBe('₱1,700');
    });

    it('rounds rather than truncates, so sub-unit amounts do not vanish', () => {
      expect(formatMoney(99, { decimals: 'never' })).toBe('₱1');
    });
  });

  describe('compact', () => {
    it('does not abbreviate below 10,000 — "₱9.5k" is no clearer than "₱9,500"', () => {
      expect(formatMoney(950000, { compact: true })).toBe('₱9,500');
    });

    it('abbreviates thousands — D§25 summary tiles', () => {
      expect(formatMoney(3000000, { compact: true })).toBe('₱30k');
      expect(formatMoney(1240000, { compact: true })).toBe('₱12.4k');
    });

    it('abbreviates millions', () => {
      expect(formatMoney(123456789, { compact: true })).toBe('₱1.2M');
    });

    it('drops the decimal above 100 of a unit', () => {
      expect(formatMoney(34000000000, { compact: true })).toBe('₱340M');
    });

    it('is opt-in — the same amount renders long by default (D§25 vs D§71)', () => {
      expect(formatMoney(3000000)).toBe('₱30,000');
      expect(formatMoney(3000000, { compact: true })).toBe('₱30k');
    });
  });

  it('omits the symbol for money inputs — D§37', () => {
    expect(formatMoney(25000, { hideSymbol: true })).toBe('250');
  });

  it('supports other currencies', () => {
    expect(formatMoney(25000, { currency: 'USD' })).toBe('$250');
    expect(formatMoney(25000, { currency: 'EUR' })).toBe('€250');
  });

  it('rejects a float — a fractional value means a float leaked into the ledger', () => {
    expect(() => formatMoney(250.5)).toThrow(TypeError);
    expect(() => formatMoney(NaN)).toThrow(TypeError);
  });
});

describe('parseMoney', () => {
  it('parses plain input', () => {
    expect(parseMoney('250')).toBe(25000);
    expect(parseMoney('250.75')).toBe(25075);
  });

  it('tolerates the symbol, commas, and whitespace', () => {
    expect(parseMoney('₱1,699.50')).toBe(169950);
    expect(parseMoney('  1,699 ')).toBe(169900);
  });

  it('rounds to the nearest minor unit rather than truncating', () => {
    expect(parseMoney('1.005')).toBe(101);
  });

  it('returns null for unparseable input rather than coercing to zero', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('.')).toBeNull();
    expect(parseMoney('-')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
  });

  it('round-trips with formatMoney', () => {
    const minor = 169950;
    expect(parseMoney(formatMoney(minor))).toBe(minor);
  });
});

describe('integer arithmetic', () => {
  it('sums without float drift — the reason minor units exist', () => {
    // 0.1 + 0.2 !== 0.3 in floats. In minor units it is exact.
    expect(sumMinor([10, 20])).toBe(30);
    expect(sumMinor([toMinor(0.1), toMinor(0.2)])).toBe(toMinor(0.3));
  });

  it('rejects floats in a sum', () => {
    expect(() => sumMinor([10, 20.5])).toThrow(TypeError);
  });

  it('converts between major and minor', () => {
    expect(toMinor(1699.5)).toBe(169950);
    expect(toMajor(169950)).toBe(1699.5);
  });
});

describe('currencySymbol', () => {
  it('returns the symbol for standalone UI use', () => {
    expect(currencySymbol()).toBe('₱');
    expect(currencySymbol('USD')).toBe('$');
  });
});
