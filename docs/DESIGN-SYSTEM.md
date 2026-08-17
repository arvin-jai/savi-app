# Savi — Front-End UI/UX Design System

**Version:** 1.0
**Platform:** Android + Web
**Framework:** React Native + Expo + NativeWind
**Design Style:** Glassmorphism + Minimal + Premium + Calm
**Primary Goal:** Make financial and schedule management feel effortless.

---

> **About this document.** This is the original v1.0 specification, reorganized into a
> navigable hierarchy. **No prescribed value has been changed** — every hex, size, weight,
> duration, radius, and ratio is carried across exactly as written. Original section numbers
> are preserved as `§n` markers.
>
> Where the specification contradicts itself, **both readings are left in place** and marked
> with a ⚠️ callout pointing at [DESIGN-REVIEW.md](DESIGN-REVIEW.md), which proposes
> resolutions.
>
> **Amendments.** Resolutions that have been accepted are applied to this file and listed
> below, so the difference from v1.0 is always visible:
>
> | # | Amendment | Sections | Rationale |
> | --- | --- | --- | --- |
> | A1 | **Available Money** defined; the term unified | §15, §26 | [BUILD-PLAN P1](BUILD-PLAN.md#p1) |
> | A2 | Semantic colors **split by usage** — `Dark` for text, `Primary` for fills | §6, §33 | [R1](DESIGN-REVIEW.md#r1) |
> | A3 | `brand-500` barred from body-size white text | §4 | [R2](DESIGN-REVIEW.md#r2) |
> | A4 | **Glass fallback colors** added; contrast measured against them | §9, §44 | [R3](DESIGN-REVIEW.md#r3) |
> | A5 | Light secondary text darkened `#71717A` → `#52525B` | §48 | [R4](DESIGN-REVIEW.md#r4) |
> | A6 | **Blur is progressive enhancement**; fallback is the baseline | §8, §9 | [R5](DESIGN-REVIEW.md#r5) |
> | A7 | Android `elevation` mapping added to the shadow scale | §21 | [R6](DESIGN-REVIEW.md#r6) |
> | A8 | `brand.action` token added | §49 | [R7](DESIGN-REVIEW.md#r7) |
> | A9 | Heading weights reconciled to the §50 token table | §13 | [R8](DESIGN-REVIEW.md#r8) |
> | A10 | Glass border alpha unified on the §53 per-level scale | §8, §19 | [R9](DESIGN-REVIEW.md#r9) |
> | A11 | Opacity scale scoped; glass owns its own values | §20 | [R10](DESIGN-REVIEW.md#r10) |
> | A12 | **Category palette rebuilt** — no semantic collisions | §7 | [R11](DESIGN-REVIEW.md#r11) |
> | A13 | Navigation unified — **five tabs**, Tasks under More | §27, §67 | [R12](DESIGN-REVIEW.md#r12) |
> | A14 | `theme` prop removed from `GlassCard` | §55 | [R13](DESIGN-REVIEW.md#r13) |
> | A15 | **Undefined states specified** — focus, layering, toast, easing, offline, overflow | §44 | [Review gaps](DESIGN-REVIEW.md#specification-gaps) |
> | A16 | Colourblindness check run: **no nine-colour palette can pass**; the dot is never load-bearing | §7 | [BUILD-PLAN risk 12](BUILD-PLAN.md#part-7--risk-register) |
> | A17 | **Bottom nav is icon-only** — a deliberate §44 deviation, with the mitigations that replace the label | §27, §44 | Hero Focus design handoff |
> | ~~A18~~ | ~~Android is translucent, just not blurred~~ — **REVERTED**, see A24 | §8, §9, §53 | Device report, v0.7.1 |
> | A19 | **Celebration surface** added alongside the toast, with a scarcity rule | §64, §59 | Device report, v0.7.1 |
> | A20 | **Password fields carry a reveal toggle** by default | §36 | Device report, v0.7.1 |
> | A21 | **Screen lock** — PIN + biometrics, offered in onboarding; what it is and is not | §67 | Device report, v0.7.2 |
> | A22 | **Home carries three shortcuts**, below the hero — the cost of A17's icon-only nav | §25, §27 | Device report, v0.7.2 |
> | A23 | **Profile leaves Settings** for the More user card; the card is pinned | §67 | Device report, v0.7.2 |
> | A24 | **A18 reverted** — glass is opaque unless blur is actually running; **no shadow on nav** | §8, §9, §27, §53 | Device report, v0.7.2 |
>
> Every ⚠️ callout from v1.0 has been resolved. Amendments are marked inline where they apply.

---

## Contents

**Part 1 — [Vision & Direction](#part-1--vision--direction)** · §1–2
**Part 2 — [Color](#part-2--color)** · §3–7
**Part 3 — [Glass](#part-3--glass)** · §8–11
**Part 4 — [Typography](#part-4--typography)** · §12–15
**Part 5 — [Space & Shape](#part-5--space--shape)** · §16–21
**Part 6 — [Components](#part-6--components)** · §22–24, §36–41, §54–55
**Part 7 — [Layout & Navigation](#part-7--layout--navigation)** · §25–28, §45–46
**Part 8 — [Patterns & States](#part-8--patterns--states)** · §29–35, §42–43, §56–64
**Part 9 — [Accessibility & Themes](#part-9--accessibility--themes)** · §44, §47–48
**Part 10 — [Design Tokens](#part-10--design-tokens)** · §49–53
**Part 11 — [Screens, Process & North Star](#part-11--screens-process--north-star)** · §65–73

---

# Part 1 — Vision & Direction

## 1.1 Design Vision (§1)

### Savi should feel like

Calm · Intelligent · Personal · Modern · Premium · Lightweight · Trustworthy · Simple · Organized

### The application should **not** feel like

- An accounting application
- A spreadsheet
- A corporate banking dashboard
- An overly colorful productivity app
- A complicated financial tool

### Design statement

> **Savi turns complicated personal information into a calm, understandable interface.**

The interface should communicate:

**"You don't need to think too hard. Savi has organized it for you."**

---

## 1.2 Visual Direction (§2)

The primary visual style is **Soft Glassmorphism**.

Use:

- Translucent cards
- Blurred backgrounds
- Soft gradients
- Large rounded corners
- Subtle borders
- Diffused shadows
- Layered surfaces
- Minimal icons
- Generous whitespace

Avoid excessive glass effects.

The UI should look like:

```text
Background
   ↓
Soft gradient / ambient light
   ↓
Blurred glass surface
   ↓
Content
   ↓
Subtle border
   ↓
Soft shadow
```

The glass effect should support hierarchy rather than become decoration.

---

# Part 2 — Color

## 2.1 Color Philosophy (§3)

| Role | Color | Represents |
| --- | --- | --- |
| **Primary** | Deep Indigo / Violet | Intelligence · Trust · Technology · Calm |
| **Secondary** | Soft Cyan / Blue | Clarity · Information · Productivity |
| **Accent** | Mint / Emerald | Savings · Positive financial movement · Success |
| **Warning** | Amber | Upcoming bills · Attention · Moderate risk |
| **Danger** | Coral / Red | Overspending · Failed payments · Urgent tasks |

---

## 2.2 Primary Color Palette (§4)

### Brand Colors

| Token       | Hex       | Usage                       |
| ----------- | --------- | --------------------------- |
| `brand-50`  | `#F5F3FF` | Very light brand background |
| `brand-100` | `#EDE9FE` | Light surfaces              |
| `brand-200` | `#DDD6FE` | Borders / highlights        |
| `brand-300` | `#C4B5FD` | Secondary accents           |
| `brand-400` | `#A78BFA` | Interactive elements        |
| `brand-500` | `#8B5CF6` | Primary brand               |
| `brand-600` | `#7C3AED` | Primary button              |
| `brand-700` | `#6D28D9` | Pressed state               |
| `brand-800` | `#5B21B6` | Dark accent                 |
| `brand-900` | `#4C1D95` | Deep brand                  |

- **Primary brand:** `#8B5CF6`
- **Primary action:** `#7C3AED`

### Amendment A3 — where each brand step may be used

`#8B5CF6` measures **4.22:1** against white. That fails AA for normal text and passes only the
3:1 large-text threshold.

| Color | May be used for | Must not be used for |
| --- | --- | --- |
| `brand-500 #8B5CF6` | Surfaces, accents, chart series, dots, glows | Any background behind white text at body size |
| `brand-600 #7C3AED` | Primary buttons, FAB, links, focus ring (**5.70:1** on white ✅) | — |
| `brand-700 #6D28D9` | Pressed state | — |

If `#8B5CF6` must carry text, that text is 18px+ bold or 24px+ regular.

---

## 2.3 Background Colors (§5)

Savi should use a slightly tinted background rather than pure white.

| | Background | Surface | Secondary Surface |
| --- | --- | --- | --- |
| **Light Mode** | `#F6F7FB` | `#FFFFFF` | `#F1F2F7` |
| **Dark Mode** | `#0B0B12` | `#15151F` | `#1C1C28` |

Avoid pure `#000000` and pure `#FFFFFF` for large UI areas.

Slightly tinted colors feel more premium and work better with glassmorphism.

---

## 2.4 Financial Colors (§6)

| Semantic | Primary | Light | Dark |
| --- | --- | --- | --- |
| **Income** | `#10B981` | `#D1FAE5` | `#047857` |
| **Expense** | `#F97316` | `#FFEDD5` | `#C2410C` |
| **Bills** | `#F59E0B` | `#FEF3C7` | `#B45309` |
| **Danger** | `#EF4444` | `#FEE2E2` | `#B91C1C` |

**Income** — use green for income, savings, positive balance, and completed financial goals.

**Expense** — use orange rather than red for ordinary spending. This prevents the interface
from making normal spending feel like an error.

**Danger** — use red only for overdue bills, failed transactions, critical warnings, and
destructive actions.

### Amendment A2 — which variant, for what

The `Primary` column **fails WCAG AA as text** on the light background: income `#10B981` is
2.39:1, expense `#F97316` 2.62:1, bill `#F59E0B` 2.01:1, danger `#EF4444` 3.51:1 — against a
4.5:1 requirement. The `Dark` column passes comfortably.

Choose the variant by **usage**, not by taste:

| Usage | Light mode | Dark mode (§47) |
| --- | --- | --- |
| **Text and icons** | `Dark` variant | `#34D399` · `#FB923C` · `#FBBF24` · `#F87171` |
| **Fills** — dots, chart series, progress bars, accents | `Primary` variant | `Primary` variant |
| **Tinted backgrounds** — badges, chips | `Light` variant | `Primary` at 12–16% opacity |

Measured contrast of the text variants on `#F6F7FB`:

| Variant | Contrast | AA |
| --- | --- | --- |
| `#047857` income dark | 5.19:1 | ✅ |
| `#C2410C` expense dark | 6.16:1 | ✅ |
| `#B45309` bill dark | 5.98:1 | ✅ |
| `#B91C1C` danger dark | 6.06:1 | ✅ |

Dark mode needed no change — its values already pass. **This was a light-mode defect only.**
§47 gains `#F87171` for danger and `#60A5FA` for info, which v1.0 omitted.

### Amendment A2b — text values darkened one further step

**Measured during M1 implementation, not predicted.** The values above pass against the *flat*
background `#F6F7FB`, but real text sits on a glass card with an ambient orb behind it (§11),
and that composite costs roughly 1.5 points. An automated audit of the rendered kitchen-sink
DOM measured `#B45309` bill text at **4.48:1** — below the threshold.

The shipping text values are one step darker:

| Semantic | §6 `Dark` | **Shipping** | Flat ratio |
| --- | --- | --- | --- |
| income | `#047857` | **`#065F46`** | 7.18:1 |
| expense | `#C2410C` | **`#9A3412`** | 6.83:1 |
| bill | `#B45309` ❌ over glass | **`#92400E`** | 6.62:1 |
| danger | `#B91C1C` | **`#991B1B`** | 7.76:1 |
| info | `#1D4ED8` | **`#1E40AF`** | 8.14:1 |

After the change: **0 failures across 129 text nodes in both themes**, worst passing pair
4.98:1. Implemented in `src/theme/tokens.ts`.

This is [A4](#glass-fallback) doing its job. Measuring against the flat background — as v1.0
implicitly did — is optimistic by enough to fail.

---

## 2.5 Category Colors (§7)

Use a controlled category palette.

### Amendment A12 — rebuilt palette

v1.0's palette reused four colors that already carry semantic meaning elsewhere, so a category
dot was indistinguishable from a financial state:

| Category | v1.0 | Collided with |
| --- | --- | --- |
| Food | `#F97316` | Expense primary (§6) |
| Health | `#10B981` | Income primary (§6) |
| Entertainment | `#8B5CF6` | Brand primary (§4) |
| Transport | `#3B82F6` | `info` token (§49) |
| Bills | `#F59E0B` | Bill semantic — *and it is a classification, not a category* |

**Reserved and unavailable to categories:** `#10B981` · `#F97316` · `#F59E0B` · `#EF4444` ·
`#8B5CF6` · `#7C3AED` · `#6D28D9` · `#3B82F6`

### The palette

| Category | Hex | Hue |
| --- | --- | --- |
| Food | `#E11D48` | rose |
| Shopping | `#C026D3` | fuchsia |
| Entertainment | `#7E22CE` | purple |
| Work | `#4F46E5` | indigo |
| Transport | `#0EA5E9` | sky |
| Health | `#0D9488` | teal |
| Education | `#65A30D` | lime |
| Personal | `#A16207` | bronze |
| Other | `#64748B` | slate |

**Bills is removed.** It is a *classification* (need / want / bill), not a category — keeping it
in both axes was the source of the ambiguity. A bill payment carries `classification = bill`
and whatever category it actually belongs to (Internet → Work or Personal, Electricity →
Personal).

### Rules

- Category color appears **only as a dot or chip** (§32, §35). It is never the color of an
  amount, and never a card background. That separation is what keeps it from being read as a
  financial state.
- Do not introduce arbitrary colors throughout the application.
- Nine hues avoiding eight reserved values leaves the fuchsia/purple pair closest together.
  **Validate this palette against a colorblindness simulator** (deuteranopia and protanopia)
  before it ships, and rely on the label rather than the dot for anything load-bearing.

### Amendment A16 — the simulator check was run, and the palette cannot pass

**Measured 2026-08-15**, closing [BUILD-PLAN risk 12](BUILD-PLAN.md#part-7--risk-register).
Implemented as `src/theme/colorVision.ts` with a permanent test, not a one-off inspection.

Dichromacy simulation (Viénot LMS) plus CIE76 ΔE across protanopia, deuteranopia and
tritanopia, in both themes. Roughly **ΔE 15** is the line for *"these are telling me different
things at a glance"*.

| Theme | protanopia | deuteranopia | tritanopia |
| --- | --- | --- | --- |
| Light | 7.7 | 7.7 | 7.9 |
| Dark | **3.2** | 3.9 | 4.9 |

**A12's prediction was wrong about which pair.** It named fuchsia/purple
(shopping/entertainment). The actual tightest is **entertainment/work** — purple against
indigo — at ΔE 3.2 in dark protanopia.

**No replacement palette passes either.** Searching 19 candidate hues for the best possible
nine, the ceiling is **ΔE 7.08**. Nine categories do not fit in a dichromatic plane, and
removing the eight reserved values makes it harder. A constrained search preserving the
semantic hues reached 6.11 — better than 3.24, still failing, and it costs transport its blue.
The unconstrained optimum was worse in the way that matters: it chose `#C2410C` and `#047857`,
the expense and income *text* colours, recreating exactly the collision [R11](DESIGN-REVIEW.md#r11)
removed.

### What this changes

**Nothing about the palette, and everything about what may depend on it.**

The hues stay as A12 set them, because the property they were chosen for — never colliding with
financial or brand meaning — is achievable, and is the one that actually helps a user
understand what they are looking at. Trading it for a margin that still fails is a bad trade.

**The dot is therefore never load-bearing, and that is now a rule rather than a preference:**

- Category colour appears only as a dot or chip beside the category **name** (§7 rules, unchanged).
- Every component that renders one carries the label: `TransactionItem` puts the category name
  in both the visible meta line and the accessibility label; `Chip` requires `label` and takes
  `dotColor` as optional decoration.
- **A category dot must never be the only signal** — the same rule §44 already applies to
  financial state (`Green + "On track"`), now stated explicitly for categories too.

The test suite keeps the two achievable properties: no reserved-value collision, and separation
that can never regress below what was measured.

---

# Part 3 — Glass

## 3.1 Glassmorphism System (§8)

Glass components should have four main properties: **Transparency · Blur · Border · Shadow**.

| Property | Light | Dark |
| --- | --- | --- |
| background | `rgba(255, 255, 255, 0.55)` | `rgba(25, 25, 38, 0.60)` |
| border | `rgba(255, 255, 255, 0.60)` | `rgba(255, 255, 255, 0.08)` |
| shadow | `0 8px 30px rgba(31, 38, 135, 0.08)` | `0 8px 30px rgba(0, 0, 0, 0.25)` |
| blur | `20px` | `20px` |

> **Amendment A10.** The light border was `0.65` in v1.0, conflicting with `0.60` in §19 and
> §24 and with the per-level scale in §53. **§53 is authoritative**; the border alpha is
> `0.50 / 0.60 / 0.70` by glass level, and the value above is the default level.

<a id="m0-findings"></a>

### M0 spike results — measured 2026-08-13

Run on the built dev APK (Expo SDK 57 / RN 0.86.2), `/dev/glass-spike`, 50 glass cards in a
`FlatList` over the ambient background.

| Question | Verdict |
| --- | --- |
| **R6** — is `boxShadow` available on Android? | ✅ **Yes.** RN 0.86 New Architecture. The `boxShadow` swatch renders a soft wide shadow visibly distinct from the harder `elevation` swatch. **The tinted shadow language holds on Android** — the `elevation` fallback in §21 is not needed. |
| **R3** — is the no-blur fallback acceptable? | ✅ **Yes.** Cards read as clearly distinct surfaces with legible text and soft shadows. Fallback-first is not a visual compromise. |
| **R5** — does blur hold 60fps in a list? | ❌ **No — A6 confirmed.** |

**R5 detail.** Measured on an emulator, which caps at ~30fps and is *not* a valid source for
absolute figures — M0 asks for a mid-range physical device and that measurement is still
outstanding. But two findings are platform-level and do not depend on the hardware:

- **Min FPS halved: 24 → 14** with blur on. A 42% relative degradation on flagship-class
  hardware.
- **A rendering artifact disqualifies it regardless of speed.** With
  `experimentalBlurMethod="dimezisBlurView"`, each card gains a hard-edged lighter rectangle
  inset from its bounds — the blur layer does not respect the border radius. It looks broken,
  not blurred.

**Conclusion:** A6 stands as written. The solid fallback is the baseline; blur is reserved for
the bottom nav, modals, sheets, and the dashboard hero — bounded, non-scrolling surfaces —
and is never applied inside a list.

---

### Amendment A6 — blur is progressive enhancement

`backdrop-filter` **does not exist in React Native.** The effect has three different realities:

| Target | Reality |
| --- | --- |
| Web | `backdrop-filter` works. No problem. |
| iOS | `expo-blur` is native and performant. |
| **Android** | `expo-blur` with `experimentalBlurMethod` — real cost, artifacts in scrolling content. |

Android is the primary platform, and §32, §34, and §35 are all **lists of glass cards** — the
worst case for it.

**Therefore the no-blur rendering is the baseline, not the degraded state.** Every glass level
has a solid fallback (§9) that keeps the border and shadow and reads as deliberate. Blur is
layered on top where the platform affords it:

| Surface | Blur |
| --- | --- |
| Bottom nav, modals, sheets, dashboard hero | Yes — bounded count on screen |
| **Any surface inside a scrolling list** | **No** |

Also note: NativeWind's `backdrop-blur-*` utilities are **web-only and silently no-op on
native**. Writing one in a component looks correct on web and does nothing on Android.

---

## 3.2 Glass Levels (§9)

Create three glass levels.

| Level | Opacity | Blur | Border | Shadow | Used for |
| --- | --- | --- | --- | --- | --- |
| **Glass 1 — Subtle** | 0.35–0.45 | 12px | 1px | Very subtle | Navigation · Secondary cards · Background controls |
| **Glass 2 — Standard** | 0.50–0.65 | 20px | 1px | Soft | Dashboard cards · Financial cards · Calendar cards · AI cards |
| **Glass 3 — Elevated** | 0.70–0.85 | 24–32px | 1px | Medium | Modals · Bottom sheets · Important AI recommendations · Quick Add panels |

**Glass 2 — Standard** should be the default Savi glass.

<a id="glass-fallback"></a>

### Amendment A4 — fallback colors

A translucent surface has no fixed contrast. Text on a 0.35-opacity card sitting over the §11
ambient orbs has an effective contrast that changes with scroll position, which means §10
Rule 3 ("text must always maintain sufficient contrast") cannot be verified as written.

Every glass level therefore has a **solid fallback** — the composite of that level over the most
saturated point of the ambient background:

| Level | Light fallback | Dark fallback |
| --- | --- | --- |
| Glass 1 — Subtle | `#EEEDF6` | `#191924` |
| Glass 2 — Standard | `#F2F1F9` | `#1B1B27` |
| Glass 3 — Elevated | `#F7F6FC` | `#1E1E2B` |

**All text contrast is measured against the fallback, never against the translucent value.**

The fallback is also what actually renders when:

- blur is unavailable on the platform (A6),
- the user has `prefers-reduced-transparency` (web),
- Android high-contrast mode is active.

This turns an untestable rule into a checkable one and supplies the no-blur baseline at the same
time. Verify the composite values against the real ambient gradient during the build — they are
computed, and computed values drift from what ships.

---

## 3.3 Glassmorphism Rules (§10)

**Rule 1.** Never put glass over a completely flat background everywhere. Use subtle ambient
gradients behind glass:

```text
Top-left:
Soft purple glow

Top-right:
Soft blue glow

Bottom:
Very subtle neutral gradient
```

**Rule 2.** Don't make every component glass. Use glass for cards, navigation, floating
actions, modals, and important sections. Keep some elements solid.

**Rule 3.** Text must always maintain sufficient contrast. Glass should never compromise
readability.

**Rule 4.** Avoid excessive transparency. If users can't distinguish the card from the
background, the glass effect has failed.

---

## 3.4 Ambient Background (§11)

The Savi background should have subtle blurred gradient orbs.

```text
                Purple glow
                     ●
       ┌─────────────────────────┐
       │                         │
       │       Savi              │
       │                         │
       │    Glass dashboard      │
       │                         │
       └─────────────────────────┘
                ●
             Blue glow
```

Recommended opacity: **5% – 15%**

Never make background gradients dominant.

---

# Part 4 — Typography

## 4.1 Font Families (§12)

**Primary Font — Inter.** Use for body, navigation, buttons, labels, numbers, and forms.
Inter is highly readable and works well for financial interfaces.

**Display Font — Plus Jakarta Sans.** Use selectively for large dashboard numbers, page
headings, marketing sections, and important statements.

The combination `Plus Jakarta Sans + Inter` creates a modern but professional appearance.

If maintaining one font is preferable, use **Inter everywhere.** Consistency is more important
than using multiple fonts.

---

## 4.2 Font Weights (§13)

Use only:

| Weight | Name | Usage |
| --- | --- | --- |
| 400 | Regular | body |
| 500 | Medium | labels |
| 600 | SemiBold | headings |
| 700 | Bold | h1 · h2 · major financial numbers |

Avoid using 800/900 except for special marketing typography.

> **Amendment A9.** v1.0's rule read `600 → headings`, contradicting §50's token table, which
> gives h1 and h2 weight **700**. The token table wins — a 700/600 ramp across the heading
> scale is the intent. Weight 600 covers **h3 and h4**; 700 covers h1 and h2.

---

## 4.3 Typography Scale (§14)

Base unit: **4px**

### Display

| Style | Size / Line height |
| --- | --- |
| Display 1 | 40px / 48px |
| Display 2 | 36px / 44px |
| Display 3 | 32px / 40px |

Use primarily for balance, major financial metrics, and hero screens.

### Headings

| Style | Size / Line height |
| --- | --- |
| H1 | 28px / 36px |
| H2 | 24px / 32px |
| H3 | 20px / 28px |
| H4 | 18px / 24px |

### Body

| Style | Size / Line height |
| --- | --- |
| Body Large | 17px / 26px |
| Body | 15px / 23px |
| Body Small | 14px / 20px |

### UI Text

| Style | Size / Line height |
| --- | --- |
| Label | 13px / 18px |
| Caption | 12px / 16px |
| Micro | 11px / 14px |

Do not use text smaller than **11px** unless absolutely necessary.

---

## 4.4 Financial Numbers (§15)

Financial numbers are extremely important in Savi.

| Property | Value |
| --- | --- |
| Font | Inter / Plus Jakarta Sans |
| Weight | 700 |
| Letter spacing | -0.5px to -1px |

Example: `₱24,500` should visually dominate its label, `Available`.

> **Amendment A1.** v1.0 called this label *"Available Balance."* It is **not** a balance —
> see [Level 1 defined](#available-money). The card label is `Available`; the full term is
> **Available Money**.

Recommended:

| | Size / Line height / Weight |
| --- | --- |
| Balance | 32px / 40px / 700 |
| Currency | 24px / 32px / 600 |

---

# Part 5 — Space & Shape

## 5.1 Spacing System (§16)

Use a 4px base grid:

`4px · 8px · 12px · 16px · 20px · 24px · 32px · 40px · 48px · 56px · 64px · 80px · 96px`

Avoid arbitrary values such as `13px`, `19px`, `27px`, `31px` unless required for a specific
component.

---

## 5.2 Spacing Rules (§17)

| Scale | Range | Use for |
| --- | --- | --- |
| Small internal | 4–8px | Icon + text · Small labels · Metadata |
| Standard | 12–16px | Card content · Form fields · List items |
| Large | 24–32px | Sections · Dashboard groups · Major components |

### Page spacing

| Breakpoint | Horizontal padding |
| --- | --- |
| Mobile | 16px |
| Tablet | 24px |
| Desktop | 32px |

Maximum content width: **1200px**

---

## 5.3 Border Radius (§18)

Savi should use noticeably rounded corners.

| Token | Value |
| --- | --- |
| `radius-xs` | 6px |
| `radius-sm` | 8px |
| `radius-md` | 12px |
| `radius-lg` | 16px |
| `radius-xl` | 20px |
| `radius-2xl` | 24px |
| `radius-3xl` | 32px |
| `radius-full` | 9999px |

### Recommended usage

| Element | Radius |
| --- | --- |
| Buttons | 12px |
| Input fields | 12px |
| Small cards | 16px |
| Main glass cards | 20px |
| Large dashboard cards | 24px |
| Bottom sheets | 28px |
| Floating buttons | 9999px |

---

## 5.4 Borders (§19)

Glass components should use extremely subtle borders.

| Mode | Border color |
| --- | --- |
| Light | `rgba(255,255,255,0.60)` |
| Dark | `rgba(255,255,255,0.08)` |

Standard width: **1px**

Do not use heavy borders around every component.

> **Amendment A10.** The single `0.60` value above is the **default** glass level. The
> authoritative per-level scale is §53: `0.50` subtle · `0.60` default · `0.70` elevated.

---

## 5.5 Opacity System (§20)

Use standardized opacity levels:

`Opacity 04: 4%` · `Opacity 08: 8%` · `Opacity 12: 12%` · `Opacity 16: 16%` ·
`Opacity 24: 24%` · `Opacity 40: 40%` · `Opacity 60: 60%` · `Opacity 80: 80%`

### Typical use

| Use | Opacity |
| --- | --- |
| Background glow | 8–12% |
| Disabled | 40% |
| Overlay / scrim | 40–60% |

Avoid extremely transparent text.

> **Amendment A11.** v1.0's scale (4/8/12/16/24/40/60/80%) claimed to govern glass surfaces at
> "40–70%", but §53 specifies `0.55` and `0.75` — values not on the scale. The scale is now
> scoped to **glows, overlays, and disabled states**. **Glass surfaces own their own values**
> in §9 and §53, and **secondary text uses a color, not an opacity** (§48) — opacity on text
> makes contrast unpredictable, which is exactly what A4 exists to prevent.

---

## 5.6 Shadows (§21)

Glassmorphism should use soft shadows rather than traditional dark shadows.

| Token | Value | Use for |
| --- | --- | --- |
| **Shadow XS** | `0 2px 8px rgba(31, 38, 135, 0.04)` | Small controls · Inputs |
| **Shadow SM** | `0 4px 16px rgba(31, 38, 135, 0.06)` | Cards |
| **Shadow MD** | `0 8px 30px rgba(31, 38, 135, 0.08)` | Elevated cards · Navigation |
| **Shadow LG** | `0 16px 40px rgba(31, 38, 135, 0.12)` | Modals · Bottom sheets |

**Dark Mode** — use darker neutral shadows: `0 8px 30px rgba(0, 0, 0, 0.25)`

Avoid overly strong shadows.

### Amendment A7 — Android

A tinted shadow needs color, offset, blur radius, and opacity. On the React Native **legacy
renderer**, Android offers only `elevation` — a single number with no color control. RN 0.76+
on the New Architecture adds `boxShadow`, which carries the full spec.

**Verify which is available at scaffold time.** If `boxShadow` works, use it and the tint holds
everywhere. If not, Android falls back to:

| Token | Web / iOS | Android `elevation` |
| --- | --- | --- |
| Shadow XS | `0 2px 8px rgba(31,38,135,0.04)` | 1 |
| Shadow SM | `0 4px 16px rgba(31,38,135,0.06)` | 2 |
| Shadow MD | `0 8px 30px rgba(31,38,135,0.08)` | 6 |
| Shadow LG | `0 16px 40px rgba(31,38,135,0.12)` | 12 |

On the fallback path the blue tint is web/iOS only, and Android shadows are neutral.

---

# Part 6 — Components

## 6.1 Buttons (§22)

### Primary Button

| Property | Value |
| --- | --- |
| Background | `#7C3AED` |
| Text | `#FFFFFF` |
| Height | 48px |
| Radius | 12px |
| Padding | 16px |
| Font | 15px / 600 |
| Pressed | `#6D28D9` |

### Secondary Button

| Property | Value |
| --- | --- |
| Background | `rgba(255,255,255,0.45)` |
| Border | `1px rgba(255,255,255,0.60)` |
| Text | `#4C1D95` |

### Ghost Button

Transparent. Use primarily for secondary actions, navigation, and cancel.

---

## 6.2 Floating Action Button (§23)

The Quick Add button should be one of Savi's signature UI elements.

| Property | Value |
| --- | --- |
| Shape | Circular or pill |
| Size (Mobile) | 56 × 56px |
| Size (Desktop) | 56 × 56px |
| Color | `#7C3AED` |
| Shadow | `0 8px 24px rgba(124,58,237,0.25)` |
| Icon | 24px |

The button should remain accessible from the primary screens.

---

## 6.3 Cards (§24)

Default Savi card:

| Property | Light | Dark |
| --- | --- | --- |
| Background | `rgba(255,255,255,0.55)` | `rgba(25,25,38,0.60)` |
| Backdrop Blur | 20px | 20px |
| Border | `1px solid rgba(255,255,255,0.60)` | `rgba(255,255,255,0.08)` |
| Radius | 20px | 20px |
| Padding | 20px | 20px |
| Shadow | `0 8px 30px rgba(31,38,135,0.08)` | `0 8px 30px rgba(0,0,0,0.25)` |

---

## 6.4 Forms (§36)

Forms should be extremely simple.

| Property | Value |
| --- | --- |
| Height | 48–52px |
| Radius | 12px |
| Padding | 14–16px |
| Font | 15px |
| Border | 1px |
| Background | Glass / slightly opaque |

Focus state:

| Property | Value |
| --- | --- |
| Border | `#8B5CF6` |
| Glow | `rgba(139,92,246,0.15)` |

### Amendment A20 — password fields reveal by default

Any `Input` with `secureTextEntry` gets an eye toggle on its right edge, 44px wide and full
field height. It is opt-**out** (`revealToggle={false}`), not opt-in, because the failure it
prevents is the expensive one: a password typed blind at sign-up and then not accepted at
sign-in, with no way to find out which of the two was the typo. Sign-up, sign-in and both fields
on password reset all carry it.

The trade is shoulder-surfing, and it is small — the field starts masked, revealing takes a
deliberate tap on the user's own device, and nothing persists the revealed state. Somewhere that
trade goes the other way (a PIN pad, a shared kiosk) passes `revealToggle={false}`. Nothing in
Savi does today.

---

## 6.5 Input Design (§37)

```text
Amount
┌─────────────────────────────┐
│ ₱        250                │
└─────────────────────────────┘
```

For money input, the amount should be visually dominant.

| Property | Value |
| --- | --- |
| Amount size | 28–32px |
| Weight | 700 |

---

## 6.6 Charts (§38)

Charts should be minimalist.

**Avoid:** 3D charts · Heavy gradients · Too many colors · Excessive labels · Decorative charts

**Use:** Area charts · Line charts · Donut charts · Simple bar charts

| Series | Color |
| --- | --- |
| Primary chart color | `#8B5CF6` |
| Secondary | `#06B6D4` |
| Income | `#10B981` |
| Expenses | `#F97316` |

---

## 6.7 Progress Bars (§39)

Savings goal:

```text
Goal
₱50,000
₱18,000 saved
████████░░░░░░
36%
```

| Property | Value |
| --- | --- |
| Track height | 8px |
| Track radius | 999px |
| Background | `rgba(139,92,246,0.12)` |
| Fill | `#8B5CF6` |

---

## 6.8 Icons (§40)

Recommended icon library: **Lucide**

Style: Outline · Simple · Consistent

| Size | Value |
| --- | --- |
| Default | 20px |
| Small | 16px |
| Large | 24px |
| Hero | 32px |

Avoid mixing multiple icon styles.

---

## 6.9 Icon Rules (§41)

Icons should support text. Do not use icons as decoration everywhere.

Good:

```text
[calendar] Calendar
```

Bad:

```text
[calendar] [sparkle] [star] [heart]
```

Keep the interface calm.

---

## 6.10 Component Hierarchy (§54)

Build the UI system from reusable components.

```text
UI
│
├── Button
├── IconButton
├── Input
├── Select
├── Checkbox
├── Switch
├── Badge
├── Avatar
├── Divider
│
├── GlassCard
├── GlassModal
├── GlassSheet
├── GlassNavbar
│
├── MoneyCard
├── TransactionItem
├── BillCard
├── GoalCard
├── TaskItem
├── CalendarEvent
├── InsightCard
│
└── EmptyState
```

---

## 6.11 GlassCard Component (§55)

Every major glass card should support:

| Prop | Values |
| --- | --- |
| `variant` | `subtle` \| `default` \| `elevated` |
| `radius` | `sm` \| `md` \| `lg` \| `xl` \| `2xl` |
| `padding` | `sm` \| `md` \| `lg` |
| `interactive` | `true` \| `false` |

This prevents developers from creating random glass styles.

> **Amendment A14.** v1.0 included a `theme: light | dark | system` prop. It is removed. Theme
> is app-global state owned by a `ThemeProvider` and read from context — exposing it per
> instance means any card can be pinned to the wrong theme, which is the exact inconsistency
> this component exists to prevent. If a deliberate inversion is ever needed (a dark hero panel
> in light mode), that is a `variant`, not a theme override.

---

# Part 7 — Layout & Navigation

## 7.1 Dashboard Layout (§25)

Mobile:

```text
┌─────────────────────────┐
│ Good morning, Alex      │
│                         │
│ Available               │
│ ₱24,500                 │
│                         │
│ ┌─────────────────────┐ │
│ │ Income   Expenses    │ │
│ │ ₱30k     ₱12k        │ │
│ └─────────────────────┘ │
│                         │
│ Upcoming                │
│ ┌─────────────────────┐ │
│ │ Internet    ₱1,699  │ │
│ └─────────────────────┘ │
│                         │
│ Savi Insight            │
│ ┌─────────────────────┐ │
│ │ You can save...     │ │
│ └─────────────────────┘ │
│                         │
│                    (+)  │
└─────────────────────────┘
```

> **Amendment A1.** The `Available` figure carries a caption line — *"after ₱5,200 in upcoming
> bills"* — not shown in this mockup. See [Level 1 defined](#available-money).
>
> Note that `Available` is **not** derived from the Income and Expenses figures beneath it.
> Those are a monthly summary (Level 5); Available is balance minus upcoming bills. The three
> numbers are not expected to reconcile with each other.

---

## 7.2 Dashboard Hierarchy (§26)

The dashboard should prioritize:

| Level | Content |
| --- | --- |
| **Level 1** | Available Money |
| **Level 2** | Upcoming Financial Obligations |
| **Level 3** | Today's Schedule |
| **Level 4** | Savi Insight |
| **Level 5** | Detailed analytics |

Do not put charts above the most important information.

<a id="available-money"></a>

### Amendment A1 — Level 1 defined

v1.0 named Level 1 but never defined it, and referred to it three different ways: *Available*
(§25, §71), *Available Money* (§26), and *Available Balance* (§15). It is now defined once,
here.

```text
Available Money  =  Current Balance  −  Upcoming Bills

Current Balance  =  Σ balances of asset accounts
                    (excludes credit cards and other liabilities)

Upcoming Bills   =  Σ unpaid bills due in the current period
```

**It is not a balance, and it is not income minus expenses.** It answers one question — *"what
can I spend right now without missing a payment?"* — which is the question the product exists
to answer.

### Naming

| Context | Term |
| --- | --- |
| The dashboard card label | `Available` |
| Everywhere else — docs, code, AI copy, settings | **Available Money** |
| Never | ~~Available Balance~~ — invites reading it as an account balance |

### Display rules

**Show the deduction.** Available is *already net of upcoming bills*. Level 2 **explains** the
number; it is not a further deduction. Without saying so, users subtract the bills a second time
and believe they have less than they do. Put a caption directly under the amount:

```text
Available
₱24,500
after ₱5,200 in upcoming bills
```

Caption uses the Caption style (12px / 16px / 400, §14) in secondary text.

**When Available is negative** — upcoming bills exceed current balance — show it rather than
flooring at zero. This is the single most useful thing Savi can tell someone, and hiding it
fails the user at the exact moment they need the app. Use the danger color as **text**
(`#B91C1C` light, per [R1](DESIGN-REVIEW.md#r1)) with a plain-language line, in the calm voice
of §63:

> Your upcoming bills are ₱1,300 more than your current balance.

Not a warning banner, not an alarm color across the card. State it and move on.

**When there are no bills**, the caption is omitted — not rendered as "after ₱0 in upcoming
bills."

---

## 7.3 Mobile Navigation (§27)

Use a floating/glass bottom navigation.

```text
┌─────────────────────────────────────┐
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Home  Calendar  Money  Savi   More  │
└─────────────────────────────────────┘
```

| Property | Value |
| --- | --- |
| Height | 72–80px |
| Radius | 24px |
| Blur | 20–24px |

Include safe-area spacing.

### Amendment A13 — five tabs

v1.0 drew four tabs here while §67 listed five Main screens, and **Tasks had no route at all**
despite having a full screen group and a desktop dashboard slot.

| Tab | Contains |
| --- | --- |
| Home | Dashboard |
| Calendar | Month · Week · Agenda · Events |
| Money | Accounts · Transactions · Bills · Budget · Goals |
| Savi | Ask Savi · Insights |
| **More** | **Tasks** · Settings · Profile · About |

**Content clearance.** A 72–80px floating nav plus a 56px FAB (§23) sit over scrolling content.
Every scrollable screen adds bottom padding of `nav height + 16px + safe-area inset`, or the
last row of every list sits underneath the nav.

### Amendment A17 — the bottom nav is icon-only

**Applied 2026-08-15** from the Hero Focus design handoff. This is the one place that handoff
deviates from the design system, and it does so **deliberately** — recorded here rather than
left as a discrepancy someone later "fixes".

§44 requires *icon plus label* and says the active state must not rest on colour alone. The
labels are now gone from the screen. What that costs and what replaces it:

| §44's concern | How it is met without the label |
| --- | --- |
| Screen reader users | `accessibilityLabel` is unchanged on every tab — **nothing is lost here**, the label was never the mechanism |
| "Which tab am I on?" announced | `accessibilityState.selected`, which is what assistive tech actually reads. The visible label never conveyed selection |
| Not colour alone | Three simultaneous cues: brand colour, a heavier stroke (2.4 vs 2), and a tinted pill behind the active icon. Any two can fail and the state still reads |
| 44×44 touch target | The row grew to compensate — an icon alone is smaller than an icon over a label, so `minHeight` is now explicit |

**What is genuinely lost:** a first-time user who does not recognise an icon no longer has a
word to read. That is a real cost, and it is the reason this is an amendment rather than a
silent edit. It is accepted because the five destinations are conventional (home, calendar,
wallet, sparkle, menu), the set is fixed at five, and every screen states its own name in an
`h1` immediately below the nav — so the answer to "where am I?" is on screen, just not in the
bar.

**If this is ever reverted**, the labels come back and this amendment is struck; do not keep a
half-version where some tabs have labels and others do not.

### Amendment A22 — Home carries three shortcuts, and why that is A17's bill arriving

A17 fixed the nav at five icon-only tabs. That left Budget, Goals and Tasks reachable only
through More — two taps and a list, which is where features go to be forgotten. Reported from
use as exactly that.

The dashboard now carries a row of three: **Budget · Goals · Tasks**, with an open count on
Tasks. Three constraints hold it in place:

- **Three, not six.** A shortcut row listing everything is a second navigation bar. Accounts and
  Bills are already reachable from the cards above them on the same screen, so they are not here.
- **Below the hero, always.** D§26 is explicit that money comes before everything else;
  navigation above Available Money turns the dashboard into a menu with a number on it.
- **A row of equal thirds, not a scroller.** Three items that all fit are three items you can hit
  without looking. A horizontal scroll would hide one behind a gesture, which is the problem
  this is solving, one level down.

The badge count is repeated in the accessible label — a "3" floating near an icon is not a
sentence a screen reader can read, and D§44 does not stop applying because the element is small.

---

## 7.4 Web Navigation (§28)

Desktop should use a glass sidebar.

```text
┌──────────────┬──────────────────────────┐
│ SAVI         │                          │
│              │ Dashboard                │
│ Dashboard    │                          │
│ Calendar     │                          │
│ Money        │                          │
│ Transactions │                          │
│ Bills        │                          │
│ Goals        │                          │
│              │                          │
│ Ask Savi     │                          │
│              │                          │
│ Settings     │                          │
└──────────────┴──────────────────────────┘
```

| Property | Value |
| --- | --- |
| Width | 240px |
| Padding | 16px |
| Radius | 24px |
| Glass | Standard |

---

## 7.5 Responsive Design (§45)

### Mobile

| Property | Value |
| --- | --- |
| Width | 320–767px |
| Padding | 16px |

Focus on one-column layout, bottom navigation, floating Add button, and large touch targets.

### Tablet

| Property | Value |
| --- | --- |
| Width | 768–1023px |
| Padding | 24px |

Can use two-column cards and expanded navigation.

### Desktop

| Property | Value |
| --- | --- |
| Width | 1024px+ |
| Padding | 32px |

Use sidebar, multi-column dashboard, expanded calendar, and more detailed analytics.

---

## 7.6 Desktop Grid (§46)

Use a 12-column layout.

```text
┌────────────────────────────────────────────┐
│                                            │
│  Balance              Spending             │
│  4 columns            4 columns            │
│                                            │
│  Bills                Savi Insight         │
│  4 columns            4 columns            │
│                                            │
│  Spending Overview                         │
│  8 columns                                 │
│                                            │
│  Schedule             Tasks                │
│  6 columns            6 columns            │
└────────────────────────────────────────────┘
```

---

# Part 8 — Patterns & States

## 8.1 AI / "Ask Savi" Screen (§29)

This should feel different from a generic chatbot.

Header:

```text
Ask Savi ✨
Your personal money & life assistant
```

```text
┌───────────────────────────────┐
│ Ask Savi                      │
│                               │
│ You                          │
│ "Can I afford a ₱4,000       │
│ laptop this month?"           │
│                               │
│ Savi                          │
│ ┌───────────────────────────┐ │
│ │ Based on your upcoming    │ │
│ │ bills and current balance │ │
│ │ ...                       │ │
│ └───────────────────────────┘ │
│                               │
│ [ Ask anything...       ] [↑] │
└───────────────────────────────┘
```

---

## 8.2 AI Message Design (§30)

Savi's messages should contain:

1. **Answer** — short direct answer.
2. **Reason** — why Savi reached that conclusion.
3. **Action** — what the user can do.

Example:

```text
You can probably afford it.

After your upcoming bills,
you'll have approximately ₱6,300.

I'd recommend waiting until
your next salary if you want
to keep your ₱5,000 savings goal.

[Create Savings Plan]
```

AI should not produce huge walls of text by default.

---

## 8.3 AI Insight Card (§31)

Signature Savi component:

```text
┌─────────────────────────────────┐
│ ✨ Savi Insight                 │
│                                 │
│ Your food spending is 24%       │
│ higher than last month.         │
│                                 │
│ You could save around ₱1,200    │
│ by reducing delivery orders.    │
│                                 │
│ [View spending]                 │
└─────────────────────────────────┘
```

Use a subtle purple gradient — `rgba(139,92,246,0.10)` — with a glass surface.

---

## 8.4 Transaction List (§32)

Each transaction should be visually simple.

```text
Food                         -₱250
Today · Need

Grab                         -₱180
Today · Transport

Salary                    +₱30,000
Aug 15 · Income
```

| Element | Style |
| --- | --- |
| Amount | 15px / 600 |
| Description | 15px / 500 |
| Metadata | 12px / 400 |

---

## 8.5 Income / Expense Indicators (§33)

| Type | Example | Light mode | Dark mode |
| --- | --- | --- | --- |
| Income | `+₱30,000` | `#047857` | `#34D399` |
| Expense | `-₱250` | Primary text, or `#C2410C` to emphasise | `#F8FAFC` / `#FB923C` |
| Overdue / failed | `-₱1,699` | `#B91C1C` | `#F87171` |

Do not make every expense red.

Red means **Problem**, not simply **Money was spent.**

> **Amendment A2.** v1.0 specified "Green" and "Orange" here, which resolve to the `Primary`
> variants — and those fail AA as text on the light background (2.39:1 and 2.62:1). Amounts use
> the **text variants** above. See [§6](#24-financial-colors-6).

---

## 8.6 Bill Cards (§34)

Upcoming bill:

```text
┌─────────────────────────────┐
│ ● Internet                  │
│                             │
│ ₱1,699                      │
│ Due tomorrow                │
│                             │
│ [Mark as paid]              │
└─────────────────────────────┘
```

| State | Accent |
| --- | --- |
| Overdue | Red |
| Due soon | Amber |
| Paid | Green |

---

## 8.7 Calendar Design (§35)

Calendar events should use subtle colored indicators rather than completely colored cards.

```text
● Green   Income
● Amber   Bill
● Blue    Work
● Purple  Task
● Pink    Personal
```

This maintains the premium aesthetic.

---

## 8.8 Micro-interactions (§42)

Savi should feel alive but not distracting.

| Interaction | Behavior |
| --- | --- |
| Button press | Scale 0.98 |
| Card press | Scale 0.99 |
| Modal | Fade + translate |
| Page transition | 150–250ms |
| Success | Small fade + scale |

Avoid excessive bouncing animations.

---

## 8.9 Animation Timing (§43)

| Token | Duration |
| --- | --- |
| Fast | 120ms |
| Normal | 200ms |
| Slow | 300ms |
| Large transition | 400ms |

Most interactions should use **150–250ms.**

---

## 8.10 Empty States (§56)

Empty states should be friendly.

```text
No bills yet

Add your recurring bills and
Savi will remind you before
they're due.

[Add a bill]
```

Avoid `No data.`

The empty state should tell users what to do next.

---

## 8.11 Loading States (§57)

Use skeleton loading rather than spinners whenever possible.

```text
┌─────────────────────────┐
│ █████████               │
│ ███████████████         │
│                         │
│ ███████   ███████       │
└─────────────────────────┘
```

| Property | Value |
| --- | --- |
| Skeleton opacity | 0.5–0.7 |
| Animation | 1.2–1.6 seconds |

---

## 8.12 Error States (§58)

Errors should be understandable.

Instead of:

```text
Error 500
```

Use:

```text
Something went wrong

Savi couldn't load your
transactions right now.

[Try again]
```

Technical details can be hidden behind an optional "Details" control.

---

## 8.13 Confirmation Rules (§59)

**Require confirmation** for destructive actions: Delete transaction · Delete bill ·
Delete account · Remove goal

**Avoid unnecessary confirmation** for harmless actions: Mark bill as paid · Complete task

---

## 8.14 UX Principle: Progressive Disclosure (§60)

Do not show every option immediately.

First level:

```text
Add Expense

Amount
Category

[Save]
```

Optional:

```text
More details

Account
Date
Notes
Tags
```

This keeps Savi fast.

---

## 8.15 UX Principle: Smart Defaults (§61)

Savi should remember common behavior.

If a user frequently records `Food → Need → GCash`, Savi should suggest those values.

If a user adds:

> "Internet ₱1,699 every 15th"

Savi should automatically suggest:

```text
Recurring
Monthly
15th
```

The user should correct Savi rather than fill everything manually.

---

## 8.16 UX Principle: One Primary Action (§62)

Each screen should have one obvious primary action.

| Screen | Primary action |
| --- | --- |
| Dashboard | **+ Add** |
| Bills | **+ Add Bill** |
| Tasks | **+ Add Task** |
| Goals | **+ Create Goal** |
| AI | **Ask Savi** |

Avoid competing primary buttons.

---

## 8.17 UX Principle: Financial Calm (§63)

Financial applications can create anxiety. Savi should avoid unnecessarily aggressive language.

Instead of:

> "WARNING! YOU SPENT TOO MUCH!"

Use:

> "Your spending is trending higher than usual."

Instead of:

> "You're failing your budget."

Use:

> "You're slightly above your planned spending this month."

Savi should feel like a supportive assistant, not a financial judge.

---

## 8.18 UX Principle: Celebrate Progress (§64)

Positive financial behavior should receive subtle positive feedback.

> ✨ Nice! You've saved ₱2,000 more than last month.

Or:

> You're 72% toward your emergency fund.

Avoid gamifying everything. The feeling should be **quiet encouragement**, not a video game.

### Amendment A19 — the celebration surface, and the rule that keeps it rare

§64 asked for positive feedback and the implementation had nowhere to put it: A15's toast is a
*safety* affordance ("this can be taken back"), deliberately quiet, and quiet is the wrong
register for "you just cleared every bill you owe this month". Those are two messages and they
need two surfaces.

`Celebration` is the second one — a centred card with an animated check burst, dismissed by a
tap or by its own 2.6s timer, plus a haptic. The toast keeps its job and runs underneath it, so
nothing about undo changes.

**The scarcity rule is the whole of §64's "avoid gamifying everything", made enforceable.** A
celebration that fires on every save is wallpaper within a day, and then the one that matters
lands on a user who has learned to dismiss it. So it fires on milestones only:

| Event | Surface |
| --- | --- |
| Last unpaid bill of the month cleared | Celebration |
| A goal crossing its target (crossing, not sitting on it) | Celebration |
| The final open task ticked off | Celebration |
| Finishing onboarding | The `ready` step, which is the same idea inline |
| Any other bill, goal contribution or task | Toast, plus a haptic |

If a proposed call site cannot be described as *a thing that does not happen most days*, it is a
toast.

Haptics are deliberately **not** suppressed under reduced motion. They are a separate OS setting
which the platform already honours, and suppressing them would remove the one channel still
working for a user who has turned motion off.

---

# Part 9 — Accessibility & Themes

## 9.1 Accessibility (§44)

Glassmorphism must never come at the expense of accessibility.

Minimum requirements:

- High text contrast
- Touch targets at least 44×44px
- Do not rely only on color
- Support larger text
- Clear focus states
- Screen reader labels
- Reduced motion support
- Keyboard navigation on Web

For financial status, don't use `Green = good` / `Red = bad` alone. Use:

```text
Green + "On track"
Red + "Overdue"
```

### Amendment A4 — how contrast is verified

Contrast is measured against the **glass fallback colors** in [§9](#glass-fallback), never
against a translucent value. A pair that passes only over a favourable background has not
passed.

Also honor, on top of reduced motion:

- `prefers-reduced-transparency` (web) → render the fallback, no blur
- Android high-contrast → render the fallback

### ~~Amendment A18 — Android is translucent, it just isn't blurred~~ (REVERTED — see A24)

**Struck. Kept here because the reasoning was wrong in an instructive way and someone will
propose it again.**

A18 argued that A4 and A6 had collapsed two separate questions into one flag: *can this platform
blur?* and *can this platform be transparent?* Only the first has a cost — `backdrop-filter` has
no React Native equivalent, while alpha compositing is free everywhere — so Android should take
the translucent `background` value on every surface and only the blur should stay gated.

The argument is correct and the result was worse. See A24.

### Amendment A24 — glass is opaque unless blur is running, and nav has no shadow

Two device reports, one root cause each. Both are reversals of things that looked right in the
abstract.

**1. Transparency without blur is not glass.** A18 made Android surfaces translucent with no
blur behind them. On a phone that reads as a card you can see the page *through* — the ambient
orbs, the row above, the text of the card underneath all stay sharp and fully legible straight
through the surface. Busier and harder to read than the flat panel it replaced.

Blur is what turns *see-through* into *frosted*, and it is not decoration on top of
transparency — it is the half that does the work. Without it, transparency is noise. So
`fallback` is the surface colour **everywhere blur is not actually rendering**, which today
means Android everywhere and every platform on a card that has not opted into blur.

This restores A4 exactly, and A4's phrasing was right the first time: the solid composite is
*the baseline, not a degraded state*. It has the second benefit of making the thing you see and
the thing the contrast audit measures the same value, with no ambient orb shifting it.

> A18 also stepped the *unblurred* bottom nav up from `subtle` to `elevated`, because a
> translucent bar floating over scrolling content let a list scroll visibly through the tab
> icons — `subtle` is only 40–45% alpha, and blur is normally what absorbs that. **That step is
> also gone.** It solved a problem the revert deletes: an unblurred nav is opaque now, so there
> is nothing to see through, and keeping it would only render the bar a shade lighter than the
> level it is specified at.

**2. The bottom nav and the desktop sidebar carry no drop shadow.** They had `shadow.md`, which
on a device read as a dark smear under a floating slab rather than as lift. Android's half is
the worse one: `elevation` is untinted and drawn natively behind the view, so it cannot be
softened to match the tinted `boxShadow` the other platforms get — against the dark theme it
mostly muddied the edge.

Neither surface needs one. Both already separate from the page with a 1px border and their own
surface colour, and each is the only floating element at its position, so there is nothing for a
shadow to disambiguate it from. **Cards keep theirs** — a card sits *among* other cards, which is
the case a shadow is actually for.

### Amendment A15 — states the spec left undefined

These are the rules the frontend would otherwise invent inconsistently:

| Concern | Rule |
| --- | --- |
| **Focus ring** | 2px `brand-600 #7C3AED`, 2px offset, on **every** interactive element — buttons, cards, nav, FAB, list rows. §36 defined one for inputs only |
| **Layering** | base 0 · content 10 · sticky header 20 · bottom nav 30 · FAB 40 · scrim 50 · sheet 60 · modal 70 · toast 80 |
| **Toast / undo** | Required. §59 removes confirmation from "Mark as paid" and "Complete task", which is only safe with an undo affordance. 5s, above the nav, one at a time |
| **Motion easing** | Standard `cubic-bezier(0.2, 0, 0, 1)` · Decelerate `cubic-bezier(0, 0, 0, 1)` · Accelerate `cubic-bezier(0.3, 0, 1, 1)` |
| **Reduced motion** | Transforms and scale removed; opacity fades retained at 120ms. Skeleton shimmer becomes a static block |
| **Component states** | Every interactive component defines default · hover (web) · pressed · focus · disabled · loading. §22 defined pressed only |
| **Offline** | A dedicated state alongside empty / loading / error (§56–58): last-known data with a banner and a retry, never a blank screen |
| **Long values** | Financial numbers shrink one display step at a time before truncating. `₱1,234,567.89` must render in a mobile card without clipping |
| **Touch targets** | 44×44px minimum — including §32 transaction rows and §35 calendar dots, which are the two that fail most easily |
| **Web fonts** | `font-display: swap`, preload the two weights above the fold, system fallback matched for metrics |

---

## 9.2 Dark Mode (§47)

Dark mode should be a first-class design.

| Role | Value |
| --- | --- |
| Background | `#0B0B12` |
| Glass | `rgba(25,25,38,0.60)` |
| Primary text | `#F8FAFC` |
| Secondary text | `#A1A1AA` |
| Brand | `#A78BFA` |
| Green — income | `#34D399` |
| Orange — expense | `#FB923C` |
| Amber — bill | `#FBBF24` |
| **Red — danger** | **`#F87171`** |
| **Blue — info** | **`#60A5FA`** |

> **Amendment A2.** v1.0 defined no dark-mode danger or info value. Both are added above.
>
> **Category colors in dark mode:** the §7 palette is tuned for light surfaces. On `#0B0B12`,
> use each category hue **two steps lighter** — the dots are small, and a dark-on-dark dot is
> invisible. Validate every one against the §9 dark fallback, not against pure black.

---

## 9.3 Light Mode (§48)

| Role | Value |
| --- | --- |
| Background | `#F6F7FB` |
| Glass | `rgba(255,255,255,0.55)` |
| Primary text | `#18181B` |
| Secondary | `#52525B` |
| Brand | `#7C3AED` |

> **Amendment A5.** Secondary text was `#71717A` in v1.0 — **4.51:1** on `#F6F7FB`, passing AA
> by 0.01 and failing over a 0.55-opacity glass surface, which is where most body content
> actually sits (§24). `#52525B` measures **≈7.2:1**, keeps its margin against the §9 fallback,
> and still reads as clearly secondary next to `#18181B`.
>
> Dark mode needed no change: `#A1A1AA` on `#0B0B12` is roughly 8:1.

---

# Part 10 — Design Tokens

These should eventually become reusable code variables.

## 10.1 Color Tokens (§49)

```text
COLORS

brand.primary        #8B5CF6    surfaces · accents · charts
brand.action         #7C3AED    primary buttons · FAB · links · focus
brand.pressed        #6D28D9    pressed state

background.light     #F6F7FB
background.dark      #0B0B12
surface.light        #FFFFFF
surface.dark         #15151F

text.primary         #18181B
text.secondary       #52525B
text.primary.dark    #F8FAFC
text.secondary.dark  #A1A1AA

                     fill        text (light)   text (dark)
income               #10B981     #047857        #34D399
expense              #F97316     #C2410C        #FB923C
bill                 #F59E0B     #B45309        #FBBF24
danger               #EF4444     #B91C1C        #F87171
info                 #3B82F6     #1D4ED8        #60A5FA
```

> **Amendment A8.** v1.0 had `brand.primary` and `brand.dark` but **no token for `#7C3AED`** —
> the color every button and the FAB actually use (§22, §23) — so §49 could not build §22. It
> also named `#6D28D9` `brand.dark` when §4 calls it the *pressed* state. Both fixed above.
>
> **Amendment A2.** Semantic colors now carry a fill value and text values per theme, so a
> token can no longer be used at a contrast that fails. **Amendment A5** updates
> `text.secondary`.

---

## 10.2 Typography Tokens (§50)

```text
display-xl  40 / 48 / 700
display-lg  36 / 44 / 700
display-md  32 / 40 / 700
h1          28 / 36 / 700
h2          24 / 32 / 700
h3          20 / 28 / 600
h4          18 / 24 / 600
body-lg     17 / 26 / 400
body        15 / 23 / 400
body-sm     14 / 20 / 400
label       13 / 18 / 500
caption     12 / 16 / 400
micro       11 / 14 / 400
```

> **Amendment A9.** This table is authoritative. §13's rule now reads `600 → h3, h4` and
> `700 → h1, h2` to match.

---

## 10.3 Spacing Tokens (§51)

```text
space-1     4px
space-2     8px
space-3     12px
space-4     16px
space-5     20px
space-6     24px
space-8     32px
space-10    40px
space-12    48px
space-14    56px
space-16    64px
space-20    80px
space-24    96px
```

---

## 10.4 Radius Tokens (§52)

```text
radius-xs   6px
radius-sm   8px
radius-md   12px
radius-lg   16px
radius-xl   20px
radius-2xl  24px
radius-3xl  32px
radius-full 9999px
```

---

## 10.5 Glass Tokens (§53)

```text
glass-subtle
background:   rgba(255,255,255,0.40)
blur:         12px
border:       rgba(255,255,255,0.50)

glass-default
background:   rgba(255,255,255,0.55)
blur:         20px
border:       rgba(255,255,255,0.60)

glass-elevated
background:   rgba(255,255,255,0.75)
blur:         28px
border:       rgba(255,255,255,0.70)
```

Dark mode equivalents should use dark translucent surfaces.

> **Amendment A10.** This per-level scale is **authoritative** for border alpha. §8's `0.65`
> was a stale value and is corrected to `0.60`; §19's single `0.60` is the default level.
>
> **Amendment A4.** Each level also carries a solid fallback — see
> [§9](#glass-fallback). All text contrast is measured against the fallback, never against the
> translucent value.

---

# Part 11 — Screens, Process & North Star

## 11.1 Savi Signature Visual (§65)

Create a recognizable visual element: **The Savi Glow** — a subtle purple/blue ambient glow
around important AI features.

```text
             ✦
       Savi Insight
   ┌───────────────────┐
   │                   │
   │  You can save...  │
   │                   │
   └───────────────────┘
        ╰─────────╯
      soft purple glow
```

| Property | Value |
| --- | --- |
| Purple | `#8B5CF6` |
| Blue | `#06B6D4` |
| Opacity | 8–15% |

This becomes part of Savi's brand identity.

---

## 11.2 Design Don'ts (§66)

Never:

- Use glass on every element
- Use strong background gradients
- Use more than 4–5 major colors on one screen
- Use pure black backgrounds
- Use pure white cards everywhere
- Use excessive shadows
- Use tiny text
- Use red for every expense
- Use excessive animations
- Put important text over busy backgrounds
- Sacrifice accessibility for visual effects
- Make every card look identical

---

## 11.3 Screen List (§67)

Initial Savi UI should contain:

**Authentication** — Splash · Welcome · Login · Sign Up · Forgot Password

**Main** — Dashboard · Calendar · Money · Ask Savi · More

**Money** — Accounts · Transactions · Add Expense · Add Income · Bills · Add Bill · Budget · Goals

**Calendar** — Month · Week · Agenda · Event Details · Add Event

**Tasks** — Task List · Task Details · Add Task

**AI** — Ask Savi · AI Insights · Recommendation Details

**Settings** — Profile · Appearance · Notifications · Currency · Security · Data · About Savi

> **Amendment A13.** The five Main screens above are now the five bottom-nav tabs (§27), and
> **Tasks lives under More** alongside Settings. v1.0 gave Tasks a screen group and a desktop
> dashboard slot (§46) but no route from anywhere.

### Amendment A23 — Profile is its own screen, and the More card is pinned

§67 lists Profile as the first section of Settings, and the More screen also shows the user's own
card. Both opened Settings, so there were two routes to one form and Settings opened on the thing
most people never change.

Profile is now **its own screen**, reached by tapping your own card — which is where a person
looks for their own name. Settings keeps what you change *about the app*: appearance, currency,
data, notifications, Ask Savi, security.

The card is also **pinned above the scroll area** on More, not scrolled with the list. It is the
screen's anchor — it says whose money this is, on the one screen that also holds Sign out.
There is no `position: sticky` in React Native; being outside the `ScrollView` is what makes it
stay.

### Amendment A21 — the screen lock (PIN and biometrics)

§67 listed Security and the app shipped "Security & PIN — Not yet". It is built: a 4-digit PIN in
the platform keychain, optional biometrics on top, offered as a real question during onboarding
with a real "Not now".

**State plainly what it is, because the alternative is a user who stops being careful.** This is
a *screen lock*. It stops whoever picks up your unlocked phone from reading your money. It does
not encrypt anything: the data lives in Supabase behind RLS, the session stays live behind the
gate, and a determined attacker with the device would go after the session token, not this. The
lock screen and the Settings pane both say so in the user's words.

| Decision | Why |
| --- | --- |
| **Exactly 4 digits** | A variable length forces a submit key onto every unlock — the pad cannot know when a 4-to-6 digit PIN is done. Fixing it lets the pad submit on the fourth tap, which is the entire ergonomic case for a PIN. |
| **`1234` and `0000` rejected** | A 5-try lockout is only a control if the first five guesses are unlikely. Those two are close to a majority of real PINs. |
| **5 tries, then 60s** | Time-based, not a permanent counter. The threat is a stranger with five minutes; a permanent lockout strands the legitimate user instead. |
| **30-second grace on backgrounding** | Locking on *every* background means the pad appears when you tab out to your bank app and straight back — the most common thing a person does while using Savi. Thirty seconds covers that and still locks a phone put down on a table. |
| **Biometrics needs a PIN under it** | A face or finger fails for reasons the user cannot fix in the moment. Without a PIN the only recovery is signing out. |
| **Biometrics proven before recorded** | Storing the preference first and discovering at the next unlock that the sensor refuses is how convenience becomes a lockout. |
| **Gate covers the router, is not a route** | A `/lock` route is navigable, back-navigable and deep-linkable — three ways past a lock screen. |
| **Signing out clears the PIN** | It is the stated recovery from forgetting one. A lock outliving the account it locked is not a security property, it is a brick. |
| **Off on web** | `expo-secure-store` has no web implementation, and a JS-side lock in a browser the user is sitting at is theatre. Reported honestly rather than half-working. |

---

## 11.4 Figma Design System (§68)

Before coding the full application, create a Figma design system containing:

Colors · Typography · Spacing · Radius · Shadows · Glass effects · Buttons · Inputs · Cards ·
Navigation · Icons · Charts · Transactions · Bills · Tasks · AI cards

Create both **Light Mode** and **Dark Mode**. Then create the main screens.

---

## 11.5 Figma Page Structure (§69)

```text
Savi Design System
│
├── Foundations
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Radius
│   ├── Shadows
│   └── Glass
│
├── Components
│   ├── Buttons
│   ├── Inputs
│   ├── Cards
│   ├── Navigation
│   ├── Lists
│   └── AI
│
├── Mobile
│   ├── Dashboard
│   ├── Calendar
│   ├── Money
│   ├── Ask Savi
│   └── Settings
│
└── Web
    ├── Dashboard
    ├── Calendar
    ├── Money
    ├── Ask Savi
    └── Settings
```

---

## 11.6 Implementation Strategy (§70)

Build the frontend in this order:

```text
1. Design tokens
       ↓
2. Typography
       ↓
3. Colors
       ↓
4. Glass components
       ↓
5. Buttons / Inputs
       ↓
6. Navigation
       ↓
7. Dashboard
       ↓
8. Money screens
       ↓
9. Calendar
       ↓
10. Tasks
       ↓
11. Ask Savi
       ↓
12. Settings
       ↓
13. Responsive Web
       ↓
14. Dark Mode
       ↓
15. Accessibility
       ↓
16. Animations / Polish
```

> See [BUILD-PLAN.md](BUILD-PLAN.md) for how this sequence maps onto actual milestones,
> including where the backend, dark mode, and accessibility work move earlier.

---

## 11.7 Final Visual Direction (§71)

The final Savi interface should feel approximately like:

```text
               SAVI
       calm ambient background

      ╭────────────────────────╮
      │                        │
      │  Good morning 👋       │
      │                        │
      │  Available             │
      │  ₱24,500               │
      │                        │
      ╰────────────────────────╯

      ╭──────────╮  ╭──────────╮
      │ Income   │  │ Expenses │
      │ ₱30,000  │  │ ₱12,400  │
      ╰──────────╯  ╰──────────╯

      Upcoming
      ╭────────────────────────╮
      │ 🟡 Internet            │
      │    ₱1,699 · Tomorrow   │
      ╰────────────────────────╯

      ╭────────────────────────╮
      │ ✨ Savi Insight        │
      │                        │
      │ You could save         │
      │ ₱1,200 this month.     │
      │                        │
      │ View details →         │
      ╰────────────────────────╯

                    ╭────╮
                    │ +  │
                    ╰────╯

      Home  Calendar  Money  Savi
```

The overall aesthetic should be:

**Soft background + translucent surfaces + purple ambient glow + strong typography +
generous spacing + subtle motion.**

---

## 11.8 Savi Design North Star (§72)

Every design decision should pass these five questions:

1. **Is it simple?** Can the user understand it immediately?
2. **Is it calm?** Does it reduce financial anxiety?
3. **Is it useful?** Does the visual element help the user make a decision?
4. **Is it consistent?** Does it follow the Savi design system?
5. **Is it accessible?** Can users comfortably read and interact with it?

If the answer is yes to all five, it belongs in Savi.

---

## 11.9 Final Design Identity (§73)

## Savi

**Spend smarter. Plan easier. Live better.**

### Visual personality

Premium + Friendly + Intelligent + Calm + Minimal

### Core visual ingredients

Glassmorphism + Purple / Indigo + Soft Cyan + Emerald + Inter + Plus Jakarta Sans +
20–24px Cards + 4px Spacing Grid + Soft Shadows + Subtle Blur + Ambient Gradients

### Most important rule

> **Glassmorphism is the atmosphere, not the content.**

The financial numbers, schedules, tasks, and recommendations must remain the visual priority.
The glass effect should make Savi feel beautiful without making it harder to use.
