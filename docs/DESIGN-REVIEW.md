# Savi Design System — Review

**Reviewing:** [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) v1.0
**Date:** 2026-08-13
**Status:** ✅ **All findings accepted and applied** — see the amendments table at the top of
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). R5 and R6 are specified but stay open as **verification
tasks** until the [M0 spike](BUILD-PLAN.md#m0--feasibility-spike) measures them on a device.

---

## How to read this

This file records *why* each change was made. The reasoning outlives the edit — when someone
later asks why income amounts aren't `#10B981`, or why `GlassCard` has no `theme` prop, the
answer is here.

Each finding follows the same shape: *what the spec said → why it was a problem → what was done
instead*. Findings are ordered by severity, not by section number.

| ID | Finding | Severity | Applied as |
| --- | --- | --- | --- |
| [R1](#r1) | Financial colors fail AA as text on the light background | Blocking | A2 |
| [R2](#r2) | `#8B5CF6` cannot carry white body text | Blocking | A3 |
| [R3](#r3) | Glass makes text contrast unmeasurable | Blocking | A4 |
| [R4](#r4) | Secondary text is at the contrast edge | Blocking | A5 |
| [R5](#r5) | Backdrop blur is weakest on the primary platform | Blocking | A6 · ⏳ M0 |
| [R6](#r6) | Soft tinted shadows may not be expressible on Android | Blocking | A7 · ⏳ M0 |
| [R7](#r7) | §49 omits the primary action color | Significant | A8 |
| [R8](#r8) | Heading weight conflict between §13 and §50 | Significant | A9 |
| [R9](#r9) | Glass border alpha conflict across §8 / §19 / §24 / §53 | Significant | A10 |
| [R10](#r10) | The opacity scale doesn't cover its own use case | Significant | A11 |
| [R11](#r11) | Category colors collide with financial semantics | Significant | A12 |
| [R12](#r12) | Navigation IA doesn't line up across four sections | Significant | A13 |
| [R13](#r13) | `GlassCard`'s `theme` prop is the wrong shape | Minor | A14 |
| [Gaps](#specification-gaps) | 11 unspecified rules the frontend will otherwise invent | Moderate | A15 |

⏳ = specified, but only a real Android device can confirm it.

---

# Blocking — Accessibility

<a id="r1"></a>

## R1 — Financial colors fail AA as text on the light background

**Affects:** §6, §32, §33

§33 prescribes green income amounts and orange expense amounts. §32 renders them at 15px/600 —
normal-size text, so the WCAG AA threshold is **4.5:1**. Measured against the §5 light
background `#F6F7FB`:

| Color | Role (§6) | Contrast on `#F6F7FB` | AA normal (4.5:1) |
| --- | --- | --- | --- |
| `#10B981` | Income primary | **2.39:1** | ❌ |
| `#F97316` | Expense primary | **2.62:1** | ❌ |
| `#F59E0B` | Bill primary | **2.01:1** | ❌ |
| `#EF4444` | Danger primary | **3.51:1** | ❌ (passes large text only) |

Amounts are the single most important content in the app (§15: *"Financial numbers are
extremely important in Savi"*), and they are currently the least readable thing on the screen.

**The fix is already inside your document.** The `Dark` column in §6 passes comfortably:

| Color | Role | Contrast on `#F6F7FB` | AA normal |
| --- | --- | --- | --- |
| `#047857` | Income dark | **5.19:1** | ✅ |
| `#C2410C` | Expense dark | **6.16:1** | ✅ |
| `#B45309` | Bill dark | **5.98:1** | ✅ |
| `#B91C1C` | Danger dark | **6.06:1** | ✅ |

### Proposal

Split each semantic color by **usage**, not by shade preference. This is a usage rule — the
palette itself does not change:

| Usage | Light mode | Dark mode |
| --- | --- | --- |
| Text and icons | `Dark` variant (§6) | §47 values (`#34D399`, `#FB923C`, `#FBBF24`) |
| Fills, dots, chart series, progress bars, accents | `Primary` variant (§6) | `Primary` variant |
| Tinted backgrounds and badges | `Light` variant (§6) | Primary at low opacity |

Add this table to §6 and correct §33 to say *"income amounts use the income **dark** value in
light mode."*

> Note the dark mode side is already fine — `#34D399` on `#0B0B12` is roughly 10:1. **This is
> a light-mode-only defect.**

---

<a id="r2"></a>

## R2 — `#8B5CF6` cannot carry white body text

**Affects:** §4, §22, §38

`#8B5CF6` against white is **4.22:1** — fails AA for normal text, passes only the 3:1 large-text
threshold. §4 names it "Primary brand," which invites its use as a button or badge background.

§22 already does the right thing by specifying `#7C3AED` for the primary button, which measures
**5.70:1** against white. ✅

### Proposal

State the boundary explicitly in §4: `brand-500 #8B5CF6` is a **surface, accent, and chart**
color. Any control with white text at body size uses `brand-600 #7C3AED`. If `#8B5CF6` must
carry text, that text has to be 18px+ bold or 24px+ regular.

---

<a id="r3"></a>

## R3 — Glass makes text contrast unmeasurable

**Affects:** §9, §10 Rule 3, §11, §44

§44 requires "high text contrast." §9 permits surfaces as transparent as **0.35 opacity**, and
§11 puts colored gradient orbs behind them. The effective contrast of any text on a glass card
therefore depends on which orb happens to sit behind that card at that scroll position — it is
not a fixed, testable number.

§10 Rule 3 states the requirement ("Text must always maintain sufficient contrast") but gives
no mechanism to verify it, which means in practice it will not be verified.

### Proposal

Give every glass level a **solid fallback color** representing its worst-case composite — the
color you get compositing that glass level over the most saturated point of the ambient
background. Then:

- All text contrast is measured against the **fallback**, never against the translucent value.
- The fallback is what actually renders when blur is unavailable ([R5](#r5)), when the user has
  `prefers-reduced-transparency` on the web, or when Android's high-contrast / "Remove
  animations" settings are active.

This turns an untestable rule into a checkable one and solves the no-blur fallback problem at
the same time.

---

<a id="r4"></a>

## R4 — Secondary text is at the contrast edge

**Affects:** §48

`#71717A` on `#F6F7FB` is **4.51:1** — it passes AA by 0.01. That margin does not survive
being placed on a glass surface at 0.55 opacity, which is exactly where §24 puts most body
content.

### Proposal

Either darken the light-mode secondary text by one step, or accept it only against the
[R3](#r3) fallback color and verify. Dark mode is fine — `#A1A1AA` on `#0B0B12` is roughly 8:1.

---

# Blocking — Platform feasibility

<a id="r5"></a>

## R5 — Backdrop blur is weakest on the primary platform

**Affects:** §2, §8, §9, §24, §27 — effectively the entire visual language

`backdrop-filter` does not exist in React Native. The spec's core effect has three very
different realities:

| Target | Reality |
| --- | --- |
| **Web** | `backdrop-filter` works broadly. No problem. |
| **iOS** | `expo-blur` `BlurView` is native and performant. Not a target, but worth knowing. |
| **Android** | Needs `expo-blur` with `experimentalBlurMethod="dimezisBlurView"` — real performance cost, and known artifacts inside scrolling content. |

Android is the primary target, and §32 (transactions), §34 (bills), and §35 (calendar) are all
**lists of glass cards** — the exact case where the Android blur implementation struggles most.

Separately: NativeWind's `backdrop-blur-*` utilities are **web-only** and silently no-op on
native. Writing `backdrop-blur-xl` in a component will look correct on web and do nothing on
Android, which is a particularly easy trap.

### Proposal

1. Make the **no-blur rendering the baseline**, not the degraded case. Raise surface opacity to
   the [R3](#r3) fallback, keep the border and the shadow. It should look deliberate, not broken.
2. Treat blur as **progressive enhancement**, gated per platform and per surface.
3. **Never blur inside a scrolling list.** Reserve it for the bottom nav, modals, sheets, and
   the dashboard hero — a bounded number of simultaneously visible surfaces.
4. Before committing: prototype a 50-row glass `FlatList` on a mid-range Android device and
   measure. This is the single largest technical risk in the design, and it is cheap to test
   early and expensive to discover late.

---

<a id="r6"></a>

## R6 — Soft tinted shadows may not be expressible on Android

**Affects:** §21, §23, §24

§21's `0 8px 30px rgba(31, 38, 135, 0.08)` needs four things: color, offset, blur radius, and
opacity. On the React Native legacy renderer, Android gives you **`elevation`** — one number,
no color control. The blue-tinted soft shadow that makes the glass look premium simply isn't
representable there.

RN 0.76+ on the New Architecture adds `boxShadow` and `filter` style props which would carry
this correctly. **Verify against the actual Expo SDK version at scaffold time** — don't assume
either way.

### Proposal

If `boxShadow` is available, use it and this finding closes. If not, add an Android `elevation`
mapping to §21 and state plainly that the tint is web/iOS only:

| Token | Web / iOS | Android `elevation` |
| --- | --- | --- |
| Shadow XS | `0 2px 8px rgba(31,38,135,0.04)` | 1 |
| Shadow SM | `0 4px 16px rgba(31,38,135,0.06)` | 2 |
| Shadow MD | `0 8px 30px rgba(31,38,135,0.08)` | 6 |
| Shadow LG | `0 16px 40px rgba(31,38,135,0.12)` | 12 |

---

# Significant — Internal contradictions

<a id="r7"></a>

## R7 — §49 omits the primary action color

**Affects:** §4, §22, §23, §49

The token list has `brand.primary #8B5CF6` and `brand.dark #6D28D9`. But `#7C3AED` — which §4
calls the primary button, and which §22 and §23 use for **every button and the FAB** — has no
token at all. Meanwhile §4 calls `#6D28D9` the *pressed* state, so `brand.dark` is named after
the wrong role.

As written, a developer implementing from §49 alone cannot build the button in §22.

### Proposal

```text
brand.primary   #8B5CF6   surfaces, accents, charts
brand.action    #7C3AED   primary buttons, FAB
brand.pressed   #6D28D9   pressed state
```

---

<a id="r8"></a>

## R8 — Heading weight conflict between §13 and §50

§13 says `600 → headings`. §50 gives h1 **28 / 36 / 700** and h2 **24 / 32 / 700**, while h3 and
h4 are 600.

Both readings are defensible — 700 for h1/h2 with 600 below is a common and reasonable ramp.
But the document currently asserts both. Pick one and make §13's rule match the token table.

---

<a id="r9"></a>

## R9 — Glass border alpha conflict across four sections

| Section | Light border alpha |
| --- | --- |
| §8 (example) | `0.65` |
| §19 (borders) | `0.60` |
| §24 (default card) | `0.60` |
| §53 (tokens) | `0.50` subtle / `0.60` default / `0.70` elevated |

§53's per-level scale is the most useful reading and is consistent with §19 and §24 at the
default level. **§8's `0.65` is the outlier** — most likely a stale value from an earlier draft.

### Proposal

Adopt §53 as authoritative and correct §8's example to `0.60`.

---

<a id="r10"></a>

## R10 — The opacity scale doesn't cover its own use case

**Affects:** §20, §53

§20 defines the scale as 4 / 8 / 12 / 16 / 24 / 40 / 60 / 80%. Then §20's own "typical use"
table calls for glass surfaces at **40–70%**, and §53 specifies **0.55** and **0.75** — neither
of which is on the scale.

### Proposal

Scope §20 to overlays, glows, disabled states, and text, and let the glass levels in §9/§53
own their own values. A single scale trying to govern both is producing values that violate it.

---

<a id="r11"></a>

## R11 — Category colors collide with financial semantics

**Affects:** §6, §7

Three of the ten category colors are the exact same hex as a financial semantic:

| Category (§7) | Hex | Collides with (§6 / §4) |
| --- | --- | --- |
| Food | `#F97316` | Expense primary |
| Health | `#10B981` | Income primary |
| Entertainment | `#8B5CF6` | Brand primary |

A Health category chip is the same green as a positive amount. A Food chip is the same orange
as "this is an expense." The user has no way to know whether a color is telling them *what kind
of thing this is* or *whether money went in or out*.

(Bills `#F59E0B` matching the bill semantic is fine — there the category and the semantic mean
the same thing.)

### Proposal

Either shift the three colliding hexes to non-semantic values, **or** restrict category color
to a single carrier — the leading dot in §32/§35 — and guarantee it never appears adjacent to
an amount. The second option is cheaper and fits §41's "icons support text, they aren't
decoration" instinct.

---

<a id="r12"></a>

## R12 — Navigation IA doesn't line up across four sections

| Section | What it says |
| --- | --- |
| §27 mobile nav | 4 tabs: Home · Calendar · Money · Savi |
| §67 Main | 5 screens: Dashboard · Calendar · Money · Ask Savi · **More** |
| §28 web sidebar | 8 items, includes Transactions / Bills / Goals, **no Tasks** |
| §46 desktop grid | Gives **Tasks** a 6-column slot |
| §67 Tasks group | Task List · Task Details · Add Task |

**Tasks have no route on mobile.** There is a full screen group for them, a dashboard slot for
them on desktop, and no way to reach them from the four-tab bar. "More" appears in the screen
list but not in the nav diagram.

### Partially resolved by the product spec

The Savi Product Specification §27 specifies **five mobile tabs — Home · Calendar · Money ·
Savi · More** — which settles the 4-vs-5 question. §27 of the design system should be corrected
to match.

**Still open:** Tasks has a screen group, a route folder, and a desktop dashboard slot, but no
entry in either navigation. Likeliest resolutions are Tasks under **More**, or Tasks folded into
Calendar as a filter since both are time-anchored. See
[BUILD-PLAN.md P9](BUILD-PLAN.md#p9) — the decision is scheduled for v0.2, before any calendar
navigation is written.

---

# Minor — API design

<a id="r13"></a>

## R13 — `GlassCard`'s `theme` prop is the wrong shape

**Affects:** §55

`variant`, `radius`, `padding`, and `interactive` are genuine per-instance concerns. `theme:
light | dark | system` is not — theme is app-global state that the component should read from
context.

Exposing it per instance means any card can be pinned to the wrong theme, which is exactly the
inconsistency §55 exists to prevent ("This prevents developers from creating random glass
styles").

### Proposal

Drop `theme` from the prop list. A `ThemeProvider` owns it; `GlassCard` consumes it. If a
deliberate inversion is ever needed (a dark hero panel in light mode), express that as a
`variant`, not as a theme override.

---

# Specification gaps

None of these are errors — they're rules that didn't exist yet. Each one would otherwise be
invented inconsistently by whoever wrote the component first.

> ✅ **All eleven are now specified** in
> [DESIGN-SYSTEM Amendment A15](DESIGN-SYSTEM.md#amendment-a15--states-the-spec-left-undefined),
> except currency formatting, which lives in [BUILD-PLAN 4.2](BUILD-PLAN.md#42-money-representation)
> because it is one function (`formatMoney()`), not a design token.

### Currency formatting — the largest gap

There is no formatting spec at all, in a finance app. §25 shows `₱30k` / `₱12k`; §71 shows
`₱30,000` / `₱12,400` for what appears to be the same dashboard card. Needs:

- Abbreviation threshold (when does 30,000 become 30k?)
- Decimal policy (always 2? never? only when non-zero?)
- Thousands grouping
- Negative representation — `-₱250` (§32) vs. parentheses
- Symbol placement and spacing

§67 lists a **Currency** setting, so hard-coded `₱` is a v1 assumption that should be written
down as one.

### Long-value overflow

No rule for `₱1,234,567.89` at 32px/700 in a mobile card. Needs truncation, auto-scaling, or a
documented max-digit contract. This *will* break the dashboard hero eventually.

### Focus ring

§44 requires web keyboard navigation. §36 defines a focus state for inputs only. Buttons,
cards, nav items, and the FAB have no focus token.

### Layering

Bottom nav, FAB, sheets, modals, and toasts all overlap, with no z-index scale defined.

### Toast / undo

§59 correctly removes confirmation from "Mark as paid" and "Complete task" — but that only
works if there's an undo affordance, and §54's component list has no toast.

### Motion

§43 gives durations but no easing curves. §44 requires reduced-motion support with no mapping —
which animations disappear entirely, which merely shorten.

### Component states

§22 defines `pressed` only. No hover (web), focus, disabled, or loading state for Button,
Input, or list items.

### Offline / stale data

Empty (§56), loading (§57), and error (§58) are covered. Offline is not — and a mobile finance
app will be offline regularly.

### Floating-nav clearance

A 72–80px floating nav (§27) plus a 56px FAB (§23) sit over scrolling content with no bottom
content-padding rule. The last row of every list will sit underneath the nav.

### Dark-mode coverage

§47 gives brand, green, orange, and amber — but **no danger, no info**, and no dark-mode
treatment for any of the ten category colors. `#6366F1` (Work) on `#0B0B12` is very low
contrast.

### Web font loading

Two families (Inter + Plus Jakarta Sans) with no loading strategy and no FOUT/FOIT handling.

---

# What's right

Worth recording so it doesn't get "fixed" later by someone with different instincts:

- **Orange, not red, for ordinary expense (§33).** Genuinely good and rare. Most finance apps
  make every purchase look like a mistake. The reasoning in §33 — *"Red means Problem, not
  simply Money was spent"* — is the sharpest line in the document.
- **Answer / Reason / Action for AI messages (§30).** The right constraint. It forces the model
  to be useful rather than chatty, and it makes responses skimmable.
- **"Green + On track" rather than color alone (§44).** Correct, and it doubles as a
  colorblindness accommodation without being framed as one.
- **Progressive disclosure on Add Expense (§60).** Amount + Category as the whole first level is
  the difference between an app people log expenses in and one they don't.
- **Money before charts (§26).** This will come under pressure the first time someone requests
  an analytics feature. It should survive that.
- **The five-question North Star (§72).** Actually usable as a review gate, unlike most design
  principles sections.
