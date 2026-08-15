/**
 * Money — integer minor units, and the only path from a number to a string.
 *
 * Amounts are ALWAYS integer minor units (centavos). Never float, never a
 * `numeric` column read into a JS number. `0.1 + 0.2 !== 0.3` is not an
 * acceptable property for a ledger.
 *
 * Amounts are stored as POSITIVE magnitudes. Direction comes from the
 * transaction's `direction` field (in/out), not from the sign of the integer.
 * See BUILD-PLAN P3.
 *
 * Neither the design system nor the product spec specified formatting, and they
 * disagreed by example: D§25 renders "₱30k" while D§71 renders "₱30,000" for what
 * appears to be the same card. This module is the resolution — abbreviation is an
 * explicit per-context option, never an automatic threshold, so a caller always
 * knows which form it is getting.
 */

export type CurrencyCode = 'PHP' | 'USD' | 'EUR';

type CurrencyMeta = {
  symbol: string;
  /** Digits in the minor unit. 2 → centavos. */
  exponent: number;
};

const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  PHP: { symbol: '₱', exponent: 2 },
  USD: { symbol: '$', exponent: 2 },
  EUR: { symbol: '€', exponent: 2 },
};

/**
 * v0.1 enforces a single currency per user (BUILD-PLAN P7). The column exists
 * from day one because adding it later means a migration over live money data,
 * but multi-currency needs an FX story before `Available Money` is computable
 * across two of them — you cannot sum ₱ and $.
 */
export const DEFAULT_CURRENCY: CurrencyCode = 'PHP';

export type SignDisplay =
  /** Never show a sign. For balances and totals. */
  | 'never'
  /** Show `-` only. */
  | 'negative'
  /** Show `+` and `-`. For transaction rows (D§32). */
  | 'always';

export type FormatMoneyOptions = {
  currency?: CurrencyCode;
  /**
   * Abbreviate to "₱30k" / "₱1.2M". Opt-in per context — a compact summary tile
   * uses it, a balance or a transaction row does not.
   */
  compact?: boolean;
  signDisplay?: SignDisplay;
  /**
   * 'auto'  — hide decimals when the minor part is zero (₱1,699 not ₱1,699.00)
   * 'always'— always two decimals
   * 'never' — round to the major unit
   */
  decimals?: 'auto' | 'always' | 'never';
  /** Omit the currency symbol. For inputs, where the symbol is a separate element. */
  hideSymbol?: boolean;
};

function assertSafeMinor(minor: number): void {
  if (!Number.isFinite(minor) || !Number.isInteger(minor)) {
    throw new TypeError(
      `Money amounts must be integer minor units, received ${minor}. ` +
        `A fractional value here means a float leaked into the ledger.`
    );
  }
}

function groupInteger(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The single number→string path in the app. Nothing else formats money.
 *
 * @param minor Integer minor units. May be negative; the sign is presentational.
 */
export function formatMoney(minor: number, options: FormatMoneyOptions = {}): string {
  assertSafeMinor(minor);

  const {
    currency = DEFAULT_CURRENCY,
    compact = false,
    signDisplay = 'negative',
    decimals = 'auto',
    hideSymbol = false,
  } = options;

  const meta = CURRENCIES[currency];
  const scale = 10 ** meta.exponent;

  const negative = minor < 0;
  const magnitude = Math.abs(minor);

  let body: string;

  if (compact) {
    body = formatCompact(magnitude, scale);
  } else {
    const major = Math.floor(magnitude / scale);
    const minorPart = magnitude % scale;

    const showDecimals =
      decimals === 'always' || (decimals === 'auto' && minorPart !== 0);

    if (decimals === 'never') {
      // Round rather than truncate, so ₱0.99 doesn't display as ₱0.
      body = groupInteger(String(Math.round(magnitude / scale)));
    } else if (showDecimals) {
      body = `${groupInteger(String(major))}.${String(minorPart).padStart(meta.exponent, '0')}`;
    } else {
      body = groupInteger(String(major));
    }
  }

  const sign = negative ? '-' : signDisplay === 'always' ? '+' : '';
  const shownSign = negative && signDisplay === 'never' ? '' : sign;
  const symbol = hideSymbol ? '' : meta.symbol;

  return `${shownSign}${symbol}${body}`;
}

/**
 * Abbreviation. Thresholds are deliberate and documented rather than emergent:
 * below 10,000 major units nothing is abbreviated, because "₱9.5k" is less
 * legible than "₱9,500" and saves almost nothing.
 */
function formatCompact(magnitudeMinor: number, scale: number): string {
  const major = magnitudeMinor / scale;

  if (major < 10_000) return groupInteger(String(Math.round(major)));

  const units: [number, string][] = [
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'k'],
  ];

  for (const [threshold, suffix] of units) {
    if (major >= threshold) {
      const value = major / threshold;
      // One decimal below 100 of the unit (₱1.2M), none above (₱340M).
      const rendered = value < 100 ? trimTrailingZero(value.toFixed(1)) : String(Math.round(value));
      return `${rendered}${suffix}`;
    }
  }

  return groupInteger(String(Math.round(major)));
}

function trimTrailingZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/**
 * Parse user input into minor units. Tolerant of the symbol, grouping commas,
 * and whitespace, because people paste and type both.
 *
 * Returns null for anything unparseable — callers show a validation message
 * rather than silently coercing to 0, which would record the wrong amount.
 */
export function parseMoney(
  input: string,
  currency: CurrencyCode = DEFAULT_CURRENCY
): number | null {
  const meta = CURRENCIES[currency];
  const cleaned = input.replace(meta.symbol, '').replace(/[,\s]/g, '').trim();

  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  if (cleaned === '.' || cleaned === '-') return null;

  if (!Number.isFinite(Number(cleaned))) return null;

  // Parse the DECIMAL STRING rather than multiplying a float.
  //
  // `Number('1.005') * 100` is 100.49999999999999, so Math.round yields 100 and
  // silently eats a centavo. That is the exact class of bug this module exists
  // to prevent, so parsing cannot itself go through a float.
  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [intPart = '', fracPart = ''] = unsigned.split('.');

  // One extra digit so we can inspect it for rounding.
  const padded = fracPart.padEnd(meta.exponent + 1, '0');
  const keptFraction = padded.slice(0, meta.exponent);
  const roundingDigit = padded.charAt(meta.exponent);

  const scale = 10 ** meta.exponent;
  let minor = (intPart === '' ? 0 : Number(intPart)) * scale + Number(keptFraction || '0');

  if (roundingDigit >= '5') minor += 1;

  return negative ? -minor : minor;
}

/** Symbol for a currency, for use as a standalone UI element (D§37 money input). */
export function currencySymbol(currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return CURRENCIES[currency].symbol;
}

/**
 * Sum minor-unit amounts. Trivial, but exists so no call site is tempted to
 * reduce over floats or mix major and minor units.
 */
export function sumMinor(amounts: number[]): number {
  let total = 0;
  for (const a of amounts) {
    assertSafeMinor(a);
    total += a;
  }
  return total;
}

/** Convert a major-unit number (e.g. from a fixture or seed) into minor units. */
export function toMinor(major: number, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  return Math.round(major * 10 ** CURRENCIES[currency].exponent);
}

/** For charts and progress bars, which legitimately need a real number. */
export function toMajor(minor: number, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  assertSafeMinor(minor);
  return minor / 10 ** CURRENCIES[currency].exponent;
}
