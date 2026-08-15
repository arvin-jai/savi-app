# Handoff: Savi Dashboard Flow (Hero Focus — 1b)

## Overview
Five screens (Home, Calendar, Money, Ask Savi, More) redesigned in a "Hero Focus" direction: a
bigger Available Money hero with an in-card balance sparkline, an icon-only bottom nav, a
horizontally-scrolling "Bills this week" row with progressive-dot pagination, and a category
donut / weekly bar chart pattern for data-heavy screens. Built entirely from your existing
`docs/DESIGN-SYSTEM.md` tokens — nothing here introduces a new color, radius, or type scale.

## About the design files
`Savi Dashboard.dc.html` is an **HTML design reference**, not code to port directly. It's built
in React Native Web-equivalent inline styles for speed of iteration. The task is to recreate
each screen as React Native components inside `src/app/(tabs)/` and `src/components/`, using
your existing primitives (`GlassCard`, `Text`, `ProgressBar`, `Button`) and `theme/tokens.ts` —
not to copy any HTML/CSS.

## Fidelity
High-fidelity. Colors, spacing, radii, and type sizes map 1:1 to `theme/tokens.ts` — see the
token table below. Treat pixel values, hex codes, and copy as final; treat exact pixel
positioning in the HTML as illustrative (RN layout will differ slightly, especially safe areas).

## What's genuinely new vs. what already exists

**Already built — reuse as-is:**
- `GlassCard`, `Text`, `InsightCard`, `BillCard`, `GlassNavbar` (structure), `ProgressBar`
- All color/spacing/radius/shadow tokens
- The Available Money card, income/expense summary, Savi Insight card content — same data, same copy

**New — needs implementing:**
1. **Balance sparkline inside the hero card** — a small SVG/`react-native-svg` line+area chart
   showing the last ~10 days of `available_money_minor`. Needs a new data hook (e.g.
   `useBalanceTrend()` in `features/transactions/api.ts`) returning a short time series.
2. **Bills-this-week horizontal scroll + progressive dots** — replace the current vertical
   `upcomingBills.map` on the dashboard with a `FlatList` (`horizontal`, `pagingEnabled` or
   `snapToInterval`) plus a small dot-row driven by `onScroll` → `scrollX / cardWidth`.
3. **Icon-only bottom nav** — `GlassNavbar.tsx` currently renders `<Text variant="micro">{tab.label}</Text>`
   under every icon (see D§44: "every tab is icon PLUS label"). This is a **deliberate deviation
   from the current spec** for a cleaner look — flag it, since D§44 ties active-state legibility
   partly to the label. If you proceed, keep `accessibilityLabel={tab.label}` on the `Pressable`
   so screen readers are unaffected, and rely on icon color + stroke-weight (already differentiated)
   for the active state.
4. **Category donut + weekly bar chart** (Money-adjacent explorations) — use `react-native-svg`
   `Circle` with `strokeDasharray` for the donut (avoid a chart library for something this simple).
5. **Ask Savi chat layout** — user/assistant bubble list + the Answer/Reason/Action `InsightCard`
   pattern already described in D§30; new is just the bubble container and the input bar.
6. **Calendar week strip + agenda timeline** — new `WeekStrip` component (7-day row, filled
   circle for today, small event dot under each day) above the existing `WeekView`/agenda list.
7. **More screen list rows** — simple `GlassCard` rows with icon + label + chevron + optional
   count badge (Tasks). No new primitive needed beyond a `ListRow` wrapper if you want to DRY it.

## Design tokens used (all from `theme/tokens.ts` — nothing new)
- Brand: `#8B5CF6` (primary/dots/fills), `#7C3AED` (buttons/FAB/active nav), `#A78BFA` (dark-mode brand)
- Glass default: light `rgba(255,255,255,.55)` / dark `rgba(25,25,38,.60)`, border `.60`/`.08`, blur 20px
- Savi Glow surfaces: `#EBE7F9` light / `#26223C` dark, shadow `0 8px 30px rgba(139,92,246,.15)`
- Semantic text: income `#065F46`/`#34D399`, bill `#92400E`/`#FBBF24`, danger `#991B1B`/`#F87171`
- Category fills: food `#E11D48`/`#FB7185`, transport `#0EA5E9`/`#38BDF8`, work `#4F46E5`/`#818CF8`, etc. (§7 palette, unchanged)
- Type: Plus Jakarta Sans 700/800 for hero numbers (36–52px), Inter for everything else
- Radius: 20–28px cards (`radius.xl`/`2xl`), 150px fixed-width bill cards, 999px pills/dots

## Screens
1. **Home** — greeting + date (new: date line under greeting, `Text variant="caption" tone="secondary"`),
   Available hero w/ sparkline, income/expense split bar (new: single 2-segment bar replacing
   the two separate summary cards), Bills-this-week horizontal scroll + dots, Savi Insight.
2. **Calendar** — title + Week/Month segmented control, 7-day strip (today = filled brand pill),
   agenda list below grouped by time, colored dot + category label per event (never dot-only, per A16).
3. **Money** — Available strip, horizontal Accounts scroll, budget progress bar, Recent transactions list.
4. **Ask Savi** — header + subtitle, chat bubbles (user right/brand-filled, Savi left/glass),
   Answer→Reason→Action content per D§30, pill input bar with circular send button (no FAB on this screen).
5. **More** — profile row, then Tasks (with count badge)/Settings/Notifications/About as glass list rows. No FAB (D§62 — no single obvious add action here).

## Files
- `Savi Dashboard.dc.html` — all screens, light + dark, as HTML reference (turns 1 and 2; screen work is in turn 2, ids `2a`–`2e`)
- `screenshots/2a-home.png` … `2e-more.png` — static captures of each screen pair (light + dark), cropped to the top portion of each phone. Reference alongside the live HTML file, which shows each screen in full.
