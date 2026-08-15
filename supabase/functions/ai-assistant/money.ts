/**
 * Money formatting for tool results — a deliberate MIRROR of src/lib/money.ts.
 *
 * ⚠️  The app's rule is that `formatMoney()` in src/lib/money.ts is the only
 * place a number becomes a string. This file breaks that rule for one reason:
 * the Edge Function runs in Deno and cannot resolve `@/lib/money`.
 *
 * The invariant is preserved by a CONTRACT TEST rather than by an import —
 * `tools.test.ts` asserts this function and `formatMoney()` agree across a
 * table of values, including the ones that historically go wrong (zero minor
 * part, exact thousands, negatives, sub-peso amounts). If either side drifts,
 * `npm test` fails.
 *
 * Kept deliberately narrow: only the subset the tools need. No `compact` mode —
 * the model should never be handed "₱1.2M" when it may need to compare figures,
 * and abbreviation is a presentation choice belonging to the UI.
 */

const SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
};

const EXPONENT = 2;

function groupInteger(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * @param minor Integer minor units. Negative renders with a leading `-`, which
 *              matters: a negative Available Money is the single most useful
 *              thing Savi can tell someone (D§26 A1) and must not be hidden.
 */
export function formatMoneyForModel(minor: number, currency = 'PHP'): string {
  if (!Number.isFinite(minor) || !Number.isInteger(minor)) {
    throw new TypeError(
      `Money amounts must be integer minor units, received ${minor}. ` +
        `A fractional value here means a float leaked into the ledger.`
    );
  }

  const symbol = SYMBOLS[currency] ?? '';
  const scale = 10 ** EXPONENT;

  const negative = minor < 0;
  const magnitude = Math.abs(minor);

  const major = Math.floor(magnitude / scale);
  const minorPart = magnitude % scale;

  // 'auto' decimals: hide them when the minor part is zero, so a bill reads
  // "₱1,699" and not "₱1,699.00".
  const body =
    minorPart === 0
      ? groupInteger(String(major))
      : `${groupInteger(String(major))}.${String(minorPart).padStart(EXPONENT, '0')}`;

  return `${negative ? '-' : ''}${symbol}${body}`;
}
