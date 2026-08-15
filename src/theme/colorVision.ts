/**
 * Colour-vision simulation, for testing the category palette (A12, risk 13's
 * sibling — BUILD-PLAN risk 12).
 *
 * A12 built a nine-hue palette that had to avoid eight reserved values, and it
 * says plainly: *"Nine hues avoiding eight reserved values leaves the
 * fuchsia/purple pair closest together. Validate this palette against a
 * colourblindness simulator before it ships."*
 *
 * A simulator is a person squinting at swatches once. This is the same check as
 * a function, so it runs on every commit and a future palette edit cannot
 * quietly reintroduce a collision.
 *
 * **What this can and cannot tell you.** It measures whether two dots are
 * *distinguishable from each other*. It says nothing about whether a user can
 * name which category a colour means — which is why D§44's rule stands
 * regardless: the label is the signal, the dot is decoration on top of it. A
 * palette passing this test is still not permission to drop the label.
 *
 * Method: Brettel/Viénot-style dichromacy simulation via LMS, then CIE76 ΔE in
 * Lab. Not the most modern deficiency model, but it is the one simulators
 * actually use, and the thing being defended against is two dots looking alike.
 */

export type Deficiency = 'protanopia' | 'deuteranopia' | 'tritanopia';

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

// sRGB ↔ linear. Dichromacy acts on light, not on gamma-encoded bytes; skipping
// this step is the most common way a hand-rolled simulator gives wrong answers.
const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toSrgb = (v: number) => {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return s * 255;
};

/** Simulate how a colour appears to someone with the given dichromacy. */
export function simulate(hex: string, deficiency: Deficiency): string {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);

  // RGB → LMS (Hunt-Pointer-Estévez, as used by Viénot et al.)
  const L = 0.31399022 * r + 0.63951294 * g + 0.04649755 * b;
  const M = 0.15537241 * r + 0.75789446 * g + 0.08670142 * b;
  const S = 0.01775239 * r + 0.10944209 * g + 0.87256922 * b;

  // Collapse the missing axis onto the plane the remaining cones can see.
  let Lp = L;
  let Mp = M;
  let Sp = S;

  if (deficiency === 'protanopia') {
    Lp = 1.05118294 * M - 0.05116099 * S;
  } else if (deficiency === 'deuteranopia') {
    Mp = 0.9513092 * L + 0.04866992 * S;
  } else {
    Sp = -0.86744736 * L + 1.86727089 * M;
  }

  // LMS → RGB
  const rl = 5.47221206 * Lp - 4.6419601 * Mp + 0.16963708 * Sp;
  const gl = -1.1252419 * Lp + 2.29317094 * Mp - 0.1678952 * Sp;
  const bl = 0.02980165 * Lp - 0.19318073 * Mp + 1.16364789 * Sp;

  return rgbToHex([toSrgb(rl), toSrgb(gl), toSrgb(bl)]);
}

// ─── Perceptual distance ────────────────────────────────────────────────────

function rgbToLab([r8, g8, b8]: RGB): [number, number, number] {
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);

  // Linear RGB → XYZ (D65)
  let x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  let y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  let z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76 ΔE between two hex colours. Roughly: <10 is "similar at a glance". */
export function deltaE(hexA: string, hexB: string): number {
  const a = rgbToLab(hexToRgb(hexA));
  const b = rgbToLab(hexToRgb(hexB));
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * The closest pair in a palette under a given deficiency.
 *
 * Returns the pair and their ΔE, so a failure names the two colours to fix
 * rather than just reporting that something is wrong.
 */
export function closestPair(
  palette: Record<string, string>,
  deficiency: Deficiency
): { a: string; b: string; deltaE: number } {
  const names = Object.keys(palette);
  let worst = { a: '', b: '', deltaE: Infinity };

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const d = deltaE(
        simulate(palette[names[i]], deficiency),
        simulate(palette[names[j]], deficiency)
      );
      if (d < worst.deltaE) worst = { a: names[i], b: names[j], deltaE: d };
    }
  }

  return worst;
}
