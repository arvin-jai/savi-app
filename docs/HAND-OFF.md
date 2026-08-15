# Savi — Hand-off

**Last updated:** 2026-08-15
**State:** Feature-complete through v0.7, plus M14–M16 (deferred scope and fixes from real
use). **v1.0 is blocked** — see [RELEASE.md](RELEASE.md). The largest gap: no AI feature has
ever called a model.
**Read this first.** Then [RELEASE.md](RELEASE.md) for what stands between here and shipping.

---

## What Savi is

An AI-powered personal life and money assistant: finance, bills, calendar, tasks, and
recommendations in one place. The differentiating claim is that **money and time live on one
surface** — you cannot answer "can I afford this?" from a budget app that doesn't know your
bills are due Friday.

*Spend smarter. Plan easier. Live better.*

---

## ⚠️ Before you touch anything

**Everything is uncommitted.** `git log` shows one commit ("Initial commit") and
`git status` shows ~63 changed/untracked files — that is the entire application, every
milestone from M0 to M16. Nothing has been branched, committed, or pushed.

**Commit before you make changes**, or a bad edit loses the whole application with no way back.

---

## The document map

Seven documents, each authoritative for something different. When they disagree, the order
below wins.

| Document | Authoritative for | Notes |
| --- | --- | --- |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | How it looks and behaves | The original v1.0 spec, **verbatim**, plus 17 numbered amendments (A1–A17). Section refs appear in code as `D§n`. |
| [DESIGN-REVIEW.md](DESIGN-REVIEW.md) | *Why* the design changed | 13 findings (R1–R13). Read this before "fixing" something that looks wrong — it may be deliberate. |
| [BUILD-PLAN.md](BUILD-PLAN.md) | Scope, order, and the product spec | Incorporates the 40-section product spec (`P§n`), 9 findings (P1–P9), and a per-milestone record of what was built and what broke. |
| [AI-BOUNDARY.md](AI-BOUNDARY.md) | What the model may see and do | Written *before* v0.4's code, as P8 requires. Cited in code as `AI-BOUNDARY §n`. Authoritative over everything else on this one subject. |
| [PIPELINE.md](PIPELINE.md) | How to run, test, and verify | Commands, gates, and the device-verification sequence. |
| [RELEASE.md](RELEASE.md) | What stands between here and v1.0 | Six blockers, the store listing, and the release checklist. |
| [PRIVACY.md](PRIVACY.md) | What Savi does with user data | Accurate about the software; publisher details still `[…]`. |

**Code cites these.** A comment saying `D§59` or `BUILD-PLAN P3` is pointing at a real
section that explains the constraint. Follow it before changing the code.

### ✅ Applied — the Hero Focus redesign

**[design_handoff_dashboard_flow/](design_handoff_dashboard_flow/README.md)** — applied
2026-08-15 (M17). Kept as the reference for what the screens are *meant* to look like.

`Savi Dashboard.dc.html` is a **reference, not code**: RN-Web-equivalent inline styles built
for iteration speed. It was rebuilt from the existing primitives, not ported. It introduced no
new tokens, and none were added.

**Its one deliberate deviation was taken and recorded as
[A17](DESIGN-SYSTEM.md#amendment-a17--the-bottom-nav-is-icon-only)** — the icon-only bottom
nav. Read A17 before touching `GlassNavbar`: the trade is written down, along with the four
things that now carry what the label used to.

**Not built from it**, and deliberately: the category donut and weekly bar chart. Those belong
to the "Insight & Data" exploration (turn 1d), not to the five screens, and D§26's *money before
charts* means they need a reason to exist beyond looking good. The budget screen already answers
"where did it go" with a waterfall.

---

## Current state

| Version | Milestone | Status |
| --- | --- | --- |
| — | M0 Feasibility spike | ✅ Blur disqualified in lists; `boxShadow` works on Android |
| v0.1 | M1–M5 Foundations → Dashboard | ✅ Money core, onboarding, insights |
| v0.2 | M8 Calendar & Tasks | ✅ Unified money+time timeline |
| v0.3 | M9 Notifications | ✅ Local reminders, verified firing on device |
| v0.4 | M10 Ask Savi | ✅ Read-only tools, boundary documented first |
| v0.5 | M11 AI Insights, Budgets & Goals | ✅ Waterfall, goals, model-written insights |
| v0.6 | M12 AI Actions | ✅ Three write tools, grants + per-action confirmation |
| v0.7 | M13 Hardening | ✅ P§30 Phase 10 executed — 22 checks |
| v0.2 (late) | M14 work_schedules & week view | ✅ Deferred at v0.2, built 2026-08-15 |
| — | M15 Account picker · bill intervals | ✅ From real use: duplicate names, every 3/6/12 months |
| — | M16 Recurring income · delete | ✅ From real use: income generates; bills & accounts deletable |
| — | M17 Hero Focus redesign | ✅ All five screens rebuilt; nav icon-only per [A17](DESIGN-SYSTEM.md) |
| — | M18 Account lifecycle → schedules | ✅ From real use: deleting/archiving an account now reaches its paydays |
| — | M19 First Android install — 5 reports | ⚠️ Built, **not device-verified**, and 4 of the 5 are device-only questions |
| v1.0 | Public MVP | ⛔ **Blocked** — see [RELEASE.md](RELEASE.md) |

**Totals:** 393 unit tests · 121 DB checks across eight suites · 15 migrations · 19 tables
(all with RLS, 70 policies) · 17 SQL functions · 2 Edge Functions. Typecheck and `deno check`
clean.

**Every risk in the register is now closed**, and the two that were open longest (12 and 13)
were closed by measurement rather than by assertion.

## ⚠️ The one that matters most

**No AI feature has ever called a model.** There is no `OPENAI_API_KEY` in this environment, so
every guard *around* the call is verified — 401 unauthenticated, 403 switched off, 403
ungranted, 503 unconfigured, in that order — and the call itself is not. The tool loop, the
payloads a model actually receives, the D§30 shape of a real reply, and the whole confirm-an-
action flow are unexercised.

```bash
echo "OPENAI_API_KEY=sk-..." > supabase/functions/.env
npx supabase functions serve
```

Do this before building anything further on top of the AI layer.

---

## Architecture in one page

```
src/
├── app/              Expo Router routes
│   ├── (auth)/       welcome · login · signup · forgot-password
│   ├── (tabs)/       index(dashboard) · calendar · money · savi · more
│   └── dev/          kitchen-sink · glass-spike   ← keep these
├── components/
│   ├── ui/           Button · Input · Text · controls · feedback
│   ├── glass/        GlassCard · GlassSheet · GlassNavbar · GlassSidebar
│   └── domain/       TransactionItem · BillCard · InsightCard · SplitBar ·
│                     BillsThisWeek
├── features/         accounts · ai · auth · bills · budgets · calendar ·
│                     goals · insights · notifications · transactions
│                     (each owns its api.ts + pure logic + screens)
├── lib/              supabase · money · dates · queryClient · routes · crashReport
└── theme/            tokens.ts (single source of truth) · ThemeProvider · colorVision
supabase/
├── migrations/       15 files, ordered
├── functions/
│   ├── ai-assistant/     index.ts (Deno, I/O) · tools.ts · actions.ts ·
│   │                     prompt.ts · money.ts
│   └── generate-insights/ index.ts — shares ai-assistant's tool layer
└── tests/            8 suites, 121 checks
```

**The rule that keeps this clean:** pure logic lives in its own file with unit tests
(`schedule.ts`, `timeline.ts`, `rules.ts`, `infer.ts`, `money.ts`, `dates.ts`); `api.ts` does
I/O only; screens compose. Every hard-won correctness decision is in the pure layer where it
can be tested without a device.

---

## Invariants you can break without noticing

These are load-bearing. Each one has a comment in the code and a test, but the failure modes
are quiet.

**Money is integer minor units.** Never float, never `numeric` into a JS number. One
`formatMoney()` in `lib/money.ts` is the only place a number becomes a string.

**Transfers are two paired rows** sharing `transfer_group_id`, with `direction` carrying the
sign. `transfer` is its own `type` so spending aggregates (`type = 'expense'`) exclude it
*structurally* — there is no filter to forget. Get this wrong and moving ₱5,000 into savings
reads as ₱5,000 spent, and the app tells a saving user they overspent.

**Available Money ≠ Remaining.** `Available = Current Balance − Upcoming Bills` (what you can
spend without missing a payment). `Remaining = Income − Expenses` (what's left of this
month's income). They answer different questions and v1.0 of the spec conflated them
— see BUILD-PLAN P1.

**Current Balance excludes liabilities.** A credit card is money owed.

**Calendar money is derived, never stored.** Bill due dates and paydays are projected from
the tables that own them. Copy them into `calendar_events` and the calendar can disagree with
the ledger. **The same rule holds for budgets** — `budgets` has no bills column, and a DB check
asserts it never grows one.

**Saving is not spending, so it needs its own aggregate.** Actual savings comes from
`saved_to_savings_minor()` (transfers into savings accounts, net of transfers out), never from
an expense total — a transfer is `type = 'transfer'` and cannot appear in one.

**AI writes are two gates, both server-side.** The grant (`ai_tool_grants`, absence means
denied) and the user's confirmation. A granted tool call is proposed, never executed; both the
grant and the arguments are re-checked when the confirmation arrives. The database itself
refuses to store a grant for anything that touches money.

**Recurring income generation must stay idempotent.** `generate_due_recurring()` runs on every
dashboard mount, so "called twice" is the normal case and what it creates is *income*. The
guarantee is a unique index on `(recurring_transaction_id, transaction_date)` — not the caller
being careful. Never replace it with a client-side read-modify-write on `next_run`; that is a
race with money at the end of it. Note the `ON CONFLICT` clause must repeat the index's
`WHERE` predicate, because the index is partial.

**Deleting an account cascades its transactions.** `transactions.account_id` is
`ON DELETE CASCADE`, so removing an account erases every transaction in it and rewrites every
historical total. The UI names the count before doing it and offers archiving instead —
"I stopped using this account" is not the same statement as "this money never existed". A bill
is different: deleting one drops its payment history but **not** the transactions those
payments created, so the spending survives.

**A bill's interval needs its anchor.** "Every 3 months" is not a schedule — anchored in
February it falls Feb/May/Aug/Nov, in January Jan/Apr/Jul/Oct. `interval_months` and
`anchor_month` travel together, and a DB constraint refuses a non-monthly bill without one.

**Dates are local, not UTC.** `todayISO()` and `parseISODate()` in `lib/dates.ts` exist
because `new Date().toISOString().slice(0,10)` files an evening purchase to the previous day
in any positive-offset zone. The DB column default is UTC `current_date`, so **the client must
always send the date explicitly.**

**RLS and GRANTs are two separate gates.** A migration that enables RLS and writes policies
but forgets `grant ... to authenticated` produces "permission denied" on every query. Write
both in the same migration — that mistake cost a debugging session in M2.

**Contrast is measured against the glass fallback**, never the translucent value. See
`theme/tokens.ts` → `glass.*.fallback` and DESIGN-SYSTEM A4.

**The Edge Function's mirrored logic is held by contract tests, not by care.** Deno cannot
import `@/lib/money` or `@/features/bills/schedule`, so `supabase/functions/ai-assistant/money.ts`
and the scheduling helpers in `tools.ts` are deliberate copies. `tools.test.ts` runs both
implementations over the same cases and fails on drift. **Change one side, change the other,
and add the case to both** — otherwise the app and the assistant will eventually disagree about
what a bill is due or what ₱1,699.50 looks like.

**The AI client talks to the Edge Function, never to a model.** If you ever find yourself adding
an API key to `src/`, stop: an Android APK is public. `App → Edge Function → AI API`.

**Never set `transform: undefined`** in a style. React Native runs `processTransform` whenever
the key is *present*; `undefined` flattens to `null` on Fabric and it calls `.forEach` on it.
Spread the key in only when there's a real array. This crashed every button press on Android
while web was fine.

---

## Gotchas that cost real time

| Symptom | Cause | Fix |
| --- | --- | --- |
| App renders black / hangs on launch (Android) | Emulator `127.0.0.1` is the *emulator*, not the host — Supabase unreachable | `adb reverse tcp:54321 tcp:54321` |
| "Unable to load script" | Metro not reachable | `adb reverse tcp:8081 tcp:8081`, and the dev client defaults to **8081** |
| Native module "not found" after adding a dep | Dev client APK predates the native module | `npx expo prebuild --platform android` then `npx expo run:android` (~20 min cold) |
| Metro "Port 8081 is being used" then exits | Orphaned Metro from a killed process | `netstat -ano \| grep :8081`, then `taskkill //PID <pid> //F` |
| Random black screen, no JS error | Emulator `systemui` ANR during cold boot | Dismiss with BACK, wait for it to settle. Not an app bug. |
| Typed routes reject a valid path | Generator emits junk (`/../lib/supabase`) and no bare `/` for a grouped index | Use `HOME` from `lib/routes.ts` |
| Web fails to resolve a just-installed package | Metro cached the pre-install resolution | Restart the dev server |
| **"Route ./settings.tsx is missing the required default export"** (and `(tabs)/_layout.tsx`) | **Not a missing export.** You launched Expo Go — `npx expo start` then `a`. SDK 53 removed Android push from Expo Go, so `expo-notifications` throws at import; the two modules that import it never finish evaluating, and Expo Router reports the symptom rather than the cause | `npx expo start --dev-client`. Savi has native modules and Expo Go is not a supported target |

---

## What's open

### Blocking nothing, but genuinely unverified

- **Ask Savi has never called a model.** Every guard up to the OpenAI call is verified — 401
  unauthenticated, 403 switched off, 403 ungranted, 503 unconfigured, in that order — but there
  is no `OPENAI_API_KEY` here, so the tool loop, the payloads the model actually receives, the
  D§30 shape of a real reply, and the whole confirm-an-action flow are unexercised. **This is
  the largest single unknown in the codebase.**
- **No device pass since v0.3.** v0.4–v0.7 plus M14 ran on web only, and that stretch added a
  `KeyboardAvoidingView`, a pinned composer, and six screens.
- **All of M19 is unverified on a device, and most of it can only be verified there.** Android
  translucency ([A18](DESIGN-SYSTEM.md)), the haptics, and whether `Celebration`'s 2.6s hold and
  burst read as rewarding rather than as an interruption are all things `react-native-web` will
  happily lie about — which is precisely how the Android glass shipped missing in the first
  place. The onboarding double-entry fix needs a genuinely fresh sign-up against the hosted
  project, not a reload. **A new build is required regardless: `expo-haptics` is a native
  module.**
- **Real Android blur is still unmeasured.** `ANDROID_BLUR` in
  [GlassCard.tsx](../src/components/glass/GlassCard.tsx) is a one-line flip to `true` that turns
  on `dimezisBlurView` for the nav and any card asking for blur. It is off because M0 measured
  blur costing frames on Android and nothing has re-measured it since. Translucency — which is
  what the "glass is gone" report was actually about — does not depend on it.
- **Hosted email confirmation is a dashboard setting, not a repo setting.**
  `supabase/config.toml` says `enable_confirmations = false`, and that governs the *local* stack
  only. Do not "fix" the hosted project with `supabase config push`: it overwrites the whole
  hosted auth block, and 7ffac6c fixed hosted password-reset redirects in the dashboard. Change
  the toggle in the dashboard.
- **TalkBack (M6).** Dynamic type at 200% is now measured; a screen-reader pass still needs a
  device, and layout-under-scaled-text is not the same thing.
- **R5 frame rate on mid-range hardware (M0).** The blur verdict rests on an emulator's
  *relative* degradation (24→14 fps) plus a rendering artifact. The artifact alone is
  disqualifying, so the conclusion holds — but the absolute number is unmeasured.
- **Prompt injection has not been tested against a live model.** The posture is sound and
  tested in JS — a task titled "ignore previous instructions…" is inert because there is no
  money tool to hijack, and the database refuses to store a grant for one — but P§30 Phase 10's
  pass against a real model needs a key.

### Recently closed, so you do not re-open them

- ✅ **Airplane-mode reconciliation (M3)** — exercised 2026-08-15. Found and fixed the
  "Not signed in" bug; the ledger does not double-write.
- ✅ **Dynamic type at 200% (M6)** — no overflow, no layout break, amounts do not clip.
- ✅ **Glass fallback colours (risk 13)** — measured against the rasterised ambient SVG.
  Conservative in both themes; left unchanged deliberately.
- ✅ **Category palette vs. colourblindness (risk 12)** — tested, and **it fails, as would any
  nine-colour palette**. Closed by making the dot never load-bearing ([A16](DESIGN-SYSTEM.md)).

### Deliberately not built

- **Multi-currency.** Column exists everywhere, single currency enforced in the app. Needs an
  FX story — a rate source, historical rates for past transactions, and a chosen display
  currency — before it can be switched on. Until then Available Money is not computable across
  two currencies, because you cannot sum ₱ and $. This is the one remaining scope carve-out and
  it is deliberate ([P7](BUILD-PLAN.md#p7)).

`work_schedules` and the week view **were** on this list and are now built — see M14.

---

## The road to v1.0

[RELEASE.md](RELEASE.md) is authoritative. The six blockers in order of how much they'd hurt to
discover late:

1. **The AI has never run.** Set the key, then ask Savi the four suggested questions and read
   the answers critically:
   - **Does it recompute?** A number not verbatim from a tool result means the system prompt is
     losing to the model, and [AI-BOUNDARY §7](AI-BOUNDARY.md) needs enforcing harder.
   - **Does it confuse Available Money with Remaining?** That was [P1](BUILD-PLAN.md#p1), the
     original blocking defect. The payload labels both explicitly; check the labels survive.
   - **Does it say "I don't know"?** Ask something the tools don't cover and confirm it declines.
   - **Grant `create_task`, then ask it to add one.** Confirm it proposes rather than saves,
     that declining saves nothing, and that revoking mid-conversation takes effect.
2. **No device pass since v0.3.** v0.4–v0.7 ran on web only, and this stretch added a
   `KeyboardAvoidingView`, a pinned composer, and four new screens. Three consecutive milestones
   have shipped native-only bugs that passed every automated gate.
3. **`com.anonymous.Savi`** — permanent once published.
4. ~~No hosted Supabase~~ — **hosted**: `savi-app` / `sednspswaeevjlfjwttu` / ap-south-1. 15
   migrations pushed, both functions deployed, `.env` repointed. Two things this does *not*
   mean: the 8 SQL suites still have not run against it (they are wired to `docker exec`), and
   the auth redirect allow-list still needs `savi://reset-password` in it or password reset
   dead-ends on the Site URL. See [RELEASE §2](RELEASE.md).
5. **Privacy policy placeholders.**
6. **No crash reporting provider** — the seam and its redaction exist, the provider does not.

**Push notifications are now warranted** and were not before: a server-generated insight (v0.5)
is the first thing the server knows that the device cannot, which is the exact test M9 set for
adding FCM. Local scheduling still covers every reminder.
