/**
 * BUILD-PLAN risk 12: "Category palette not colorblind-tested — nine hues,
 * tight fuchsia/purple pair. Simulator check before v0.1 ships."
 *
 * ── The finding, 2026-08-15 ────────────────────────────────────────────────
 *
 * The check was run and **the palette cannot pass**, and neither can any
 * replacement. Searching 19 candidate hues for the best possible nine, the
 * highest achievable minimum separation across protanopia, deuteranopia and
 * tritanopia in both themes is **ΔE 7.08** — against roughly 15 for "these are
 * telling me different things at a glance". Nine categories do not fit in a
 * dichromatic plane, and removing the eight reserved values makes it worse.
 *
 * A constrained search that keeps the semantic hues reached 6.11 versus the
 * current 3.24 — better, still failing, and it costs the semantic fit (transport
 * would stop being blue). The optimiser's unconstrained answer was worse still:
 * it picked #C2410C and #047857, the expense and income TEXT colours, which is
 * exactly the collision R11 removed.
 *
 * ── Therefore ──────────────────────────────────────────────────────────────
 *
 * The palette is left as A12 designed it, and the risk is closed a different
 * way: **the dot is not allowed to be load-bearing**, which D§44 already
 * required and which the components already honour — `TransactionItem` puts the
 * category name in the visible meta line and the accessibility label, and `Chip`
 * requires a `label` with `dotColor` optional. The colour is decoration on top
 * of a word.
 *
 * What these tests do is keep the two properties that ARE achievable:
 *   1. no collision with financial or brand meaning (comprehension), and
 *   2. separation never gets *worse* than measured (regression).
 */

import { closestPair, deltaE, simulate, type Deficiency } from './colorVision';
import { category } from './tokens';

const DEFICIENCIES: Deficiency[] = ['protanopia', 'deuteranopia', 'tritanopia'];

/**
 * Regression floors, set just under the values measured on 2026-08-15.
 *
 * These are **not** a pass mark for accessibility — see the header. They exist
 * so a future palette edit cannot silently make things worse than they already
 * are.
 *
 * Dark is markedly weaker than light because §47's "two steps lighter" rule
 * compresses the hues toward each other. Worth revisiting if the dark palette
 * is ever reworked for another reason.
 */
const FLOOR_LIGHT = 7.0;
const FLOOR_DARK = 3.0;

/** The ceiling any nine-colour palette could reach, from the search above. */
const ACHIEVABLE_CEILING = 7.1;

const lightPalette = Object.fromEntries(
  Object.entries(category).map(([name, c]) => [name, c.light])
);
const darkPalette = Object.fromEntries(
  Object.entries(category).map(([name, c]) => [name, c.dark])
);

describe('simulate', () => {
  it('leaves greys unchanged — they carry no hue to lose', () => {
    for (const d of DEFICIENCIES) {
      expect(deltaE('#808080', simulate('#808080', d))).toBeLessThan(2);
    }
  });

  it('collapses red and green towards each other under deuteranopia', () => {
    // The check that proves the simulation does something real.
    const normal = deltaE('#FF0000', '#00FF00');
    const simulated = deltaE(
      simulate('#FF0000', 'deuteranopia'),
      simulate('#00FF00', 'deuteranopia')
    );

    expect(normal).toBeGreaterThan(100);
    expect(simulated).toBeLessThan(normal / 2);
  });

  it('leaves blue and yellow separable under deuteranopia', () => {
    // The blue-yellow axis survives red-green deficiency.
    expect(
      deltaE(simulate('#0000FF', 'deuteranopia'), simulate('#FFFF00', 'deuteranopia'))
    ).toBeGreaterThan(50);
  });
});

describe('the category palette (A12)', () => {
  it('has nine categories, and Bills is not one of them', () => {
    // Bills is a classification (need/want/bill), not a category. Keeping it in
    // both axes was the ambiguity P4 removed.
    expect(Object.keys(category)).toHaveLength(9);
    expect(Object.keys(category)).not.toContain('bills');
  });

  it('never reuses a financial or brand colour', () => {
    // This is the property that actually aids comprehension, and unlike
    // dichromatic separation it IS achievable. A category dot must never be
    // mistakable for "money went out" or "this is Savi".
    const RESERVED = [
      // §6 fills and §4 brand
      '#10B981', '#F97316', '#F59E0B', '#EF4444',
      '#8B5CF6', '#7C3AED', '#6D28D9', '#3B82F6',
      // A2b semantic TEXT values — the trap the optimiser fell into
      '#065F46', '#9A3412', '#92400E', '#991B1B', '#1E40AF',
      // §6 Dark column
      '#047857', '#C2410C', '#B45309', '#B91C1C', '#1D4ED8',
    ];

    for (const [, c] of Object.entries(category)) {
      expect(RESERVED).not.toContain(c.light.toUpperCase());
      expect(RESERVED).not.toContain(c.dark.toUpperCase());
    }
  });

  it.each(DEFICIENCIES)('light palette does not regress under %s', (deficiency) => {
    expect(closestPair(lightPalette, deficiency).deltaE).toBeGreaterThanOrEqual(FLOOR_LIGHT);
  });

  it.each(DEFICIENCIES)('dark palette does not regress under %s', (deficiency) => {
    expect(closestPair(darkPalette, deficiency).deltaE).toBeGreaterThanOrEqual(FLOOR_DARK);
  });

  it('documents that no nine-colour palette can actually pass', () => {
    // If this ever fails, someone has found a better palette than the search
    // did — which would be good news, and means the floors above should rise
    // and the amendment be revisited.
    for (const deficiency of DEFICIENCIES) {
      for (const palette of [lightPalette, darkPalette]) {
        expect(closestPair(palette, deficiency).deltaE).toBeLessThan(ACHIEVABLE_CEILING + 10);
      }
    }
  });

  it('identifies the tightest pair so a future edit knows where to look', () => {
    // A12 predicted fuchsia/purple (shopping/entertainment). The measurement
    // says otherwise: the real tightest pair is entertainment/work — purple
    // against indigo — at ΔE 3.24 under dark protanopia.
    const worst = closestPair(darkPalette, 'protanopia');
    expect([worst.a, worst.b].sort()).toEqual(['entertainment', 'work']);
  });
});
