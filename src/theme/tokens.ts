/**
 * Savi design tokens — the single source of truth.
 *
 * Derived from docs/DESIGN-SYSTEM.md with all amendments applied. Section references
 * (§n) point at that document; amendment references (A-n) point at its amendments table.
 *
 * Nothing in the app should hard-code a color, size, radius, duration, or shadow.
 * If a value is needed and isn't here, it belongs here first.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Brand (§4, A3, A8)
// ─────────────────────────────────────────────────────────────────────────────

export const brand = {
  50: '#F7F7F7',
  100: '#EEEEEE',
  200: '#D8D8D8',
  300: '#AFAFAF',
  400: '#777777',
  /** Surfaces, accents, charts. NEVER a background for body-size white text (4.22:1). */
  500: '#2A2A2A',
  /** Primary buttons, FAB, links, focus ring. 5.70:1 on white. */
  600: '#171717',
  /** Pressed state. */
  700: '#0D0D0D',
  800: '#050505',
  900: '#000000',
} as const;

/** Semantic aliases — A8. Use these, not the numeric steps. */
export const brandRole = {
  primary: brand[500],
  action: brand[600],
  pressed: brand[700],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Financial semantics (§6, A2)
//
// A semantic color has three distinct jobs and three distinct values. Using the
// `fill` value as text fails WCAG AA on the light background — that was the v1.0
// defect (income 2.39:1, expense 2.62:1, bill 2.01:1, danger 3.51:1).
// ─────────────────────────────────────────────────────────────────────────────

type Semantic = {
  /** Dots, chart series, progress bars, accents. Never text. */
  fill: string;
  /** Text and icons on the light background. */
  textLight: string;
  /** Text and icons on the dark background. */
  textDark: string;
  /** Tinted backgrounds — badges, chips. */
  tintLight: string;
};

/**
 * `textLight` values are one step darker than the D§6 "Dark" column.
 *
 * D§6's values pass AA against the FLAT background (#F6F7FB), but real text sits
 * on a glass card with an ambient orb behind it (D§11), and that composite costs
 * roughly 1.5 points of contrast. Measured in the kitchen-sink audit, D§6's
 * `#B45309` bill landed at 4.48:1 — below the 4.5 threshold.
 *
 * Ratios below are against the flat background; the effective ratio over glass
 * is lower. The extra margin is what makes them safe there.
 */
export const semantic = {
  income: {
    fill: '#10B981',
    textLight: '#065F46', // 7.18:1 flat (D§6 gave #047857 at 5.19)
    textDark: '#34D399',
    tintLight: '#D1FAE5',
  },
  expense: {
    fill: '#F97316',
    textLight: '#9A3412', // 6.83:1 flat (D§6 gave #C2410C at 6.16)
    textDark: '#FB923C',
    tintLight: '#FFEDD5',
  },
  bill: {
    fill: '#F59E0B',
    textLight: '#92400E', // 6.62:1 flat (D§6 gave #B45309 at 5.98 — measured 4.48 over glass)
    textDark: '#FBBF24',
    tintLight: '#FEF3C7',
  },
  danger: {
    fill: '#EF4444',
    textLight: '#991B1B', // 7.76:1 flat (D§6 gave #B91C1C at 6.06)
    textDark: '#F87171', // 7.09:1 on #0B0B12 — A2 added this; v1.0 had no dark danger
    tintLight: '#FEE2E2',
  },
  info: {
    fill: '#3B82F6',
    textLight: '#1E40AF', // 8.14:1 flat (D§6 gave #1D4ED8 at 6.26)
    textDark: '#60A5FA', // 7.71:1 on #0B0B12 — A2 added this
    tintLight: '#DBEAFE',
  },
} as const satisfies Record<string, Semantic>;

export type SemanticName = keyof typeof semantic;

// ─────────────────────────────────────────────────────────────────────────────
// Categories (§7, A12)
//
// Rebuilt to remove four collisions with reserved semantic values:
//   Food #F97316 = expense · Health #10B981 = income
//   Entertainment #8B5CF6 = brand · Transport #3B82F6 = info
//
// "Bills" is deliberately absent — it is a *classification* (need/want/bill),
// not a category. See BUILD-PLAN P4.
//
// Category color appears ONLY as a dot or chip. Never an amount, never a card
// background. That separation is what keeps it from reading as a money state.
//
// TODO(M1): validate against a deuteranopia/protanopia simulator before v0.1.
// The fuchsia/purple pair is the tightest at ~21° apart.
// ─────────────────────────────────────────────────────────────────────────────

export const category = {
  food: { light: '#E11D48', dark: '#FB7185' },
  shopping: { light: '#C026D3', dark: '#E879F9' },
  entertainment: { light: '#7E22CE', dark: '#C084FC' },
  work: { light: '#4F46E5', dark: '#818CF8' },
  transport: { light: '#0EA5E9', dark: '#38BDF8' },
  health: { light: '#0D9488', dark: '#2DD4BF' },
  education: { light: '#65A30D', dark: '#A3E635' },
  personal: { light: '#A16207', dark: '#FACC15' },
  other: { light: '#64748B', dark: '#94A3B8' },
} as const;

export type CategoryName = keyof typeof category;

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces & text (§5, §47, §48, A5)
// ─────────────────────────────────────────────────────────────────────────────

export const color = {
  light: {
    background: '#F3F3F3',
    surface: '#FFFFFF',
    surfaceSecondary: '#F6F6F6',
    textPrimary: '#151515',
    /** A5: was #71717A (4.51:1 — passed by 0.01, failed over glass). Now ~7.2:1. */
    textSecondary: '#676767',
    brand: brandRole.action,
    border: 'rgba(0,0,0,0.09)',
  },
  dark: {
    background: '#09090A',
    surface: '#171719',
    surfaceSecondary: '#202023',
    textPrimary: '#F7F7F7',
    textSecondary: '#9B9B9F',
    brand: '#FFFFFF',
    border: 'rgba(255,255,255,0.09)',
  },
} as const;

export type ThemeName = keyof typeof color;

// ─────────────────────────────────────────────────────────────────────────────
// Glass (§8, §9, §53 — A4, A6, A10)
//
// `fallback` is the solid composite of this level over the ambient background.
// It is what renders when blur is unavailable (Android without the enhancement,
// prefers-reduced-transparency, high-contrast), AND it is the surface every
// contrast ratio in this file is measured against. Never measure text contrast
// against the translucent `background` value — it has no fixed contrast.
//
// ✅ MEASURED 2026-08-15 (closes BUILD-PLAN risk 13). These values were computed
// rather than sampled, so they were verified against the real thing: the shipped
// AmbientBackground SVG was rasterised to a canvas, the pixel furthest from the
// page background found, and each level's rgba composited over it.
//
//   light  worst ambient #DDF0F6 → subtle #EBF6FA · default #F0F8FB · elevated #F7FBFD
//   dark   worst ambient #141124 → subtle #161525 · default #171625 · elevated #181726
//
// The tokens below differ by up to 9/255 in one channel and are **conservative
// in both themes**: every text pair measures HIGHER contrast against the real
// composite than against the token, so nothing that passes here fails on screen.
// Worst measured pair across both themes is danger-on-elevated at 6.38:1,
// against a 4.5:1 requirement. They are therefore left unchanged — moving them
// to match would trade a safe margin for a precise one.
//
// One assumption was wrong and is worth knowing: the worst-case point in light
// mode is the CYAN orb, not the purple one. The tokens lean purple, which is why
// their green channel sits low — and low is the safe direction here.
// ─────────────────────────────────────────────────────────────────────────────

export type GlassLevel = 'subtle' | 'default' | 'elevated';

export const glass = {
  light: {
    subtle: {
      background: 'rgba(255,255,255,0.40)',
      border: 'rgba(255,255,255,0.50)',
      blur: 12,
      fallback: '#FFFFFF',
    },
    default: {
      background: 'rgba(255,255,255,0.55)',
      border: 'rgba(255,255,255,0.60)',
      blur: 20,
      fallback: '#FFFFFF',
    },
    elevated: {
      background: 'rgba(255,255,255,0.75)',
      border: 'rgba(255,255,255,0.70)',
      blur: 28,
      fallback: '#FFFFFF',
    },
  },
  dark: {
    subtle: {
      background: 'rgba(23,23,25,0.82)',
      border: 'rgba(255,255,255,0.06)',
      blur: 12,
      fallback: '#151517',
    },
    default: {
      background: 'rgba(23,23,25,0.90)',
      border: 'rgba(255,255,255,0.08)',
      blur: 20,
      fallback: '#18181A',
    },
    elevated: {
      background: 'rgba(23,23,25,0.96)',
      border: 'rgba(255,255,255,0.10)',
      blur: 28,
      fallback: '#1C1C1E',
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// The Savi Glow (§65, §31)
//
// `surface*` is §31's rgba(139,92,246,·) brand tint pre-composited over the
// `default` glass fallback — an opaque colour, computed the same way and for
// the same reason as the fallbacks above.
//
// It must stay opaque. A translucent tint here is not merely a lighter shade:
// on Android the card's drop shadow is drawn BEHIND the view, so a see-through
// body lets that shadow bleed into the card's own interior and the surface
// reads as a muddy grey block rather than a tint.
// ─────────────────────────────────────────────────────────────────────────────

export const saviGlow = {
  /** rgba(139,92,246,0.07) over glass.light.default.fallback. */
  surfaceLight: '#FFFFFF',
  /** rgba(139,92,246,0.10) over glass.dark.default.fallback. */
  surfaceDark: '#1C1C1E',
  /** The ambient shadow. Inside §65's 8–15% band — it marks, it does not shout. */
  shadow: '0 10px 30px rgba(0,0,0,0.08)',
  /** Attention keeps the brand hue, one step stronger — never a red alarm (§63). */
  shadowAttention: '0 10px 30px rgba(0,0,0,0.12)',
} as const;

/**
 * Ambient background orbs (§11). Opacity stays 5–15% — never dominant.
 */
export const ambient = {
  purple: '#000000',
  blue: '#000000',
  opacity: 0,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography (§14, §50 — A9)
//
// A9: weight 700 for h1/h2, 600 for h3/h4. v1.0's prose said "600 → headings",
// contradicting its own token table. The table won.
// ─────────────────────────────────────────────────────────────────────────────

export const fontFamily = {
  /** Body, navigation, buttons, labels, forms. */
  sans: 'Inter',
  /** Large numbers, page headings. Selective use only (§12). */
  display: 'PlusJakartaSans',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

type TypeStyle = {
  size: number;
  lineHeight: number;
  weight: (typeof fontWeight)[keyof typeof fontWeight];
  letterSpacing?: number;
};

export const type = {
  displayXl: { size: 40, lineHeight: 48, weight: '700', letterSpacing: -1 },
  displayLg: { size: 36, lineHeight: 44, weight: '700', letterSpacing: -0.75 },
  displayMd: { size: 32, lineHeight: 40, weight: '700', letterSpacing: -0.5 },
  h1: { size: 28, lineHeight: 36, weight: '700' },
  h2: { size: 24, lineHeight: 32, weight: '700' },
  h3: { size: 20, lineHeight: 28, weight: '600' },
  h4: { size: 18, lineHeight: 24, weight: '600' },
  bodyLg: { size: 17, lineHeight: 26, weight: '400' },
  body: { size: 15, lineHeight: 23, weight: '400' },
  bodySm: { size: 14, lineHeight: 20, weight: '400' },
  label: { size: 13, lineHeight: 18, weight: '500' },
  caption: { size: 12, lineHeight: 16, weight: '400' },
  /** Floor. Nothing smaller than 11px (§14). */
  micro: { size: 11, lineHeight: 14, weight: '400' },
} as const satisfies Record<string, TypeStyle>;

export type TypeName = keyof typeof type;

/** Financial numbers (§15). Tight tracking, bold, display face. */
export const money = {
  balance: { size: 32, lineHeight: 40, weight: '700', letterSpacing: -0.75 },
  currency: { size: 24, lineHeight: 32, weight: '600', letterSpacing: -0.5 },
  row: { size: 15, lineHeight: 23, weight: '600' },
  input: { size: 30, lineHeight: 38, weight: '700', letterSpacing: -0.75 },
} as const satisfies Record<string, TypeStyle>;

// ─────────────────────────────────────────────────────────────────────────────
// Space & shape (§16, §18, §51, §52)
// ─────────────────────────────────────────────────────────────────────────────

/** 4px base grid. Avoid arbitrary values (13, 19, 27, 31). */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 68,
  full: 9999,
} as const;

/** Page padding by breakpoint (§17, §45). */
export const layout = {
  pagePaddingMobile: space[4],
  pagePaddingTablet: space[6],
  pagePaddingDesktop: space[8],
  maxContentWidth: 1200,
  breakpointTablet: 768,
  breakpointDesktop: 1024,
  /** Floating nav (§27). */
  navHeight: 68,
  fabSize: 56,
  /**
   * A15: every scrollable screen needs this much bottom padding, plus the
   * safe-area inset, or the last row sits under the floating nav.
   *
   * The nav FLOATS: navHeight (76) + its bottom margin (12) + breathing room
   * (24). The first pass used navHeight + 16 and the last row of the Money
   * screen slid visibly underneath the bar — measured on screen, not guessed.
   */
  scrollBottomInset: 76 + space[3] + space[6],
  /** FAB resting position: clear of the floating nav plus a gap. */
  fabBottomOffset: 76 + space[3] + space[4],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shadows (§21, A7)
//
// A7: on the RN legacy renderer Android has only `elevation` — one number, no
// color. RN 0.76+ New Architecture supports `boxShadow`, which carries the tint.
// `elevation` below is the fallback mapping. See M0 findings.
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  xs: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)', elevation: 1 },
  sm: { boxShadow: '0 4px 16px rgba(0,0,0,0.06)', elevation: 2 },
  md: { boxShadow: '0 8px 30px rgba(0,0,0,0.08)', elevation: 6 },
  lg: { boxShadow: '0 16px 40px rgba(0,0,0,0.12)', elevation: 12 },
  /** FAB (§23) — brand-tinted. */
  fab: { boxShadow: '0 8px 24px rgba(0,0,0,0.24)', elevation: 8 },
} as const;

export const shadowDark = {
  xs: { boxShadow: '0 2px 8px rgba(0,0,0,0.15)', elevation: 1 },
  sm: { boxShadow: '0 4px 16px rgba(0,0,0,0.20)', elevation: 2 },
  md: { boxShadow: '0 8px 30px rgba(0,0,0,0.25)', elevation: 6 },
  lg: { boxShadow: '0 16px 40px rgba(0,0,0,0.35)', elevation: 12 },
  fab: { boxShadow: '0 8px 24px rgba(0,0,0,0.40)', elevation: 8 },
} as const;

export type ShadowName = keyof typeof shadow;

// ─────────────────────────────────────────────────────────────────────────────
// Opacity (§20, A11)
//
// A11: scoped to glows, overlays, and disabled states. Glass surfaces own their
// own values (see `glass`), and secondary text uses a COLOR, not an opacity —
// opacity on text makes contrast unpredictable, which is what A4 exists to stop.
// ─────────────────────────────────────────────────────────────────────────────

export const opacity = {
  glow: 0.12,
  disabled: 0.4,
  scrim: 0.5,
  pressedOverlay: 0.08,
  skeleton: 0.6,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Motion (§42, §43 — A15)
// ─────────────────────────────────────────────────────────────────────────────

export const duration = {
  fast: 120,
  normal: 200,
  slow: 300,
  large: 400,
} as const;

/** A15: v1.0 gave durations but no curves. */
export const easing = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
} as const;

export const pressScale = {
  button: 0.98,
  card: 0.99,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Layering (A15)
//
// v1.0 had nav, FAB, sheets, modals, and toasts all overlapping with no scale.
// ─────────────────────────────────────────────────────────────────────────────

export const z = {
  base: 0,
  content: 10,
  stickyHeader: 20,
  bottomNav: 30,
  fab: 40,
  scrim: 50,
  sheet: 60,
  modal: 70,
  toast: 80,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Focus (A15)
//
// §44 requires web keyboard navigation; §36 defined focus for inputs only.
// This applies to every interactive element — buttons, cards, nav, FAB, rows.
// ─────────────────────────────────────────────────────────────────────────────

export const focus = {
  width: 2,
  offset: 2,
  color: brandRole.action,
  /** Input focus glow (§36). */
  glow: 'rgba(0,0,0,0.12)',
  glowBorder: brand[500],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility (§44)
// ─────────────────────────────────────────────────────────────────────────────

export const a11y = {
  /** Minimum touch target. Transaction rows and calendar dots fail this most easily. */
  minTouchTarget: 44,
  /** Toast dwell before auto-dismiss — must outlast a glance (A15). */
  toastDuration: 5000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Icons (§40)
// ─────────────────────────────────────────────────────────────────────────────

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  hero: 32,
} as const;

export const tokens = {
  brand,
  brandRole,
  semantic,
  category,
  color,
  glass,
  saviGlow,
  ambient,
  fontFamily,
  fontWeight,
  type,
  money,
  space,
  radius,
  layout,
  shadow,
  shadowDark,
  opacity,
  duration,
  easing,
  pressScale,
  z,
  focus,
  a11y,
  iconSize,
} as const;

export default tokens;
