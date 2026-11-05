# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What Savi is

A personal money + life assistant (Expo / React Native / Supabase). The product claim is that
**money and time live on one surface** — you cannot answer "can I afford this?" from a budget
app that doesn't know your bills are due Friday.

## Before you start

**Commit before making changes.** The app is committed now (M0–M18 landed in `5fe75a2`), but
everything since is working-tree only and there is still no remote — nothing is pushed, so a
destructive git operation loses whatever is uncommitted with no way back.

**Nothing runs without `.env`.** Copy `.env.example` and fill in the two values that
`npx supabase start` prints. `src/lib/supabase.ts` throws at import if they are missing, so the
symptom is the whole app failing to boot rather than a clear message about configuration.
Anything prefixed `EXPO_PUBLIC_` is bundled into the client and readable by anyone holding the
APK — the service-role key and the model key must never appear there.

## The docs are load-bearing — read them before changing behaviour

`docs/` is not background reading. Code comments cite these by section (`D§59`, `P§23`,
`BUILD-PLAN P3`, `AI-BOUNDARY §7`), and those references point at real reasoning.

| Doc | Authoritative for |
| --- | --- |
| `HAND-OFF.md` | **Start here.** Current state, invariants, gotchas |
| `BUILD-PLAN.md` | Scope + product spec (`P§n`), and a per-milestone record of what broke |
| `DESIGN-SYSTEM.md` | How it looks and behaves (`D§n`), plus amendments A1–A24 |
| `DESIGN-REVIEW.md` | *Why* the design changed (R1–R13) — read before "fixing" something odd |
| `AI-BOUNDARY.md` | What the model may see and do. Authoritative over everything else on that |
| `PIPELINE.md` | How to run, test and verify |
| `RELEASE.md` | The six v1.0 blockers |
| `PRIVACY.md` | What Savi does with user data — accurate about the software; publisher details still blank |

`README.md` is untouched `create-expo-app` boilerplate. Ignore it — its "Get started" tells you
to run `npx expo start`, which is the trap described under Commands below.

When a milestone completes, `BUILD-PLAN.md` gets a record of **what was built and what broke**,
and anything unverified is written down as unverified. That convention is why the open-items
list is trustworthy — keep it.

### `docs/design_handoff_dashboard_flow/` — applied (M17), kept as the reference

The "Hero Focus" redesign of the five main screens. **It is built.** The folder is now the
reference for what the screens are *meant* to look like, not a proposal.

- **`Savi Dashboard.dc.html` is a reference, not code to port.** RN-Web-equivalent inline styles
  built for iteration speed. Screens were rebuilt from the existing primitives. Its pixel
  positioning is illustrative; colours, copy and type sizes are final.
- **It introduced no new tokens**, and none were added. If a change here seems to need a new
  colour or radius, something has been misread.
- **Its one deliberate D§44 deviation was taken and recorded as
  [A17](docs/DESIGN-SYSTEM.md)** — the icon-only bottom nav. Read A17 before touching
  `GlassNavbar`; the trade is written down along with the four things now carrying what the
  label used to.
- **Where the reference and an amendment disagree, the amendment wins.** Ask Savi's send button
  is drawn at 34px, below A15's 44px floor, and it is the screen's primary action — it ships at
  44. Check any pixel value in the HTML against A15 before matching it.

**Not built from it, deliberately:** the category donut and weekly bar chart. D§26's *money
before charts* means they need a reason beyond looking good, and the budget screen already
answers "where did it go" with a waterfall.

## Commands

```bash
npm run verify                                 # typecheck + tests — the quick gate
npm run typecheck                              # tsc --noEmit
npx deno check supabase/functions/*/index.ts   # the 2 files tsc cannot see (Deno globals)
npm test                                        # jest, 435 tests
npx jest src/features/bills                     # one directory
npx jest -t "clamps the 31st"                   # one test by name
npm run db:test:all                             # all 9 SQL suites, needs Supabase up
npm run db:test:budgets                         # one suite — see package.json for the rest
npm run lint
```

Dev servers — **never plain `npx expo start` then `a`**: that launches Expo Go, where
`expo-notifications` throws at import and Expo Router then reports the two routes that import it
as *"missing the required default export"*. The error names the wrong problem.

```bash
npx supabase start && npx supabase migration up
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:54321 tcp:54321   # BOTH, or the app hangs
npx expo start --dev-client --port 8081
npm run web                                     # also wants 8081 — run one or the other
```

`.claude/launch.json` runs web on **8082** (`savi-web`) precisely so it does not collide with the
device server on 8081 — both can be up at once. Start it through the preview tooling rather than
a bare `npm run web` when a dev-client session is already running.

### Two config files that look like boilerplate and are not

- **`metro.config.js`** exists for one reason: `expo run:android` makes Gradle write build
  intermediates *inside* `node_modules/<pkg>/android/build/` (8.7 GB here), and Metro watches
  them — producing an `ENOENT … watch '…/mergeReleaseResources/out/single'` crash and `EMFILE`
  on a second instance. Neither message mentions Gradle. The `blockList` is the belt; deleting
  those directories is the braces. The header comment has the PowerShell one-liner.
- **`nativewind` is a dependency but is deliberately not wired up.** `src/global.css` is plain
  CSS with no Tailwind directives and there is no `tailwind.config.js`, so `metro.config.js`
  does *not* call `withNativeWind`. Styling goes through the design-system primitives, not
  utility classes — do not "fix" this by adding the Tailwind pipeline.

## Architecture

### The layering rule that makes the test gate work

Every non-trivial decision lives in a **pure function, in its own file, with no I/O**, so it is
testable without a device or a database:

```
schedule.ts · timeline.ts · rules.ts · waterfall.ts · goals.ts · shifts.ts · week.ts
spend.ts · security/pin.ts
        ↑ pure, unit-tested          api.ts ↑ I/O only          screens ↑ compose
```

`security/` is the clearest case: `pin.ts` holds the length rule, the weak-PIN rejections and
the lockout arithmetic with no keychain in sight; `store.ts` is the keychain. The security
*decisions* run on CI and only the plumbing needs a phone.

If a rule can only be tested by rendering a screen, it is in the wrong file. Two files were
moved for exactly this during development (`lib/crashReport.ts`, `calendar/week.ts`) — the
symptom is a test failing to import because the module pulled in `AsyncStorage`.

### Supabase is the backend; there is no API server

RLS is the authorization layer, so the client talks to PostgREST directly. Edge Functions exist
only for work that must not happen on the client — holding the model key, enforcing tool grants.

**RLS and GRANT are two independent gates**, and both must be written in the *same migration* as
the table. A missing grant is loud (`permission denied`); a grant without RLS is silent and is a
breach. The hardening suite asserts schema-wide that every public table has RLS *and* a policy,
so a new table without one fails the suite rather than shipping.

DB suites run as real Postgres roles with real JWT claims — they assert a second user *cannot*
see the first user's rows, not that a policy string exists. Scope assertions to fixture ids, not
global counts.

### The Deno mirror problem — contract tests

Edge Functions run in Deno and **cannot import `@/lib/money` or `@/features/bills/schedule`**.
Those rules are therefore mirrored inside `supabase/functions/ai-assistant/`. The mirrors are
not trusted: `tools.test.ts` runs *both* implementations over the same cases, so drift fails
`npm test` rather than shipping two different answers about money.

**Change one side, change the other, and add the case to both.** Currently mirrored: money
formatting, bill due-date scheduling, bill intervals, goal month arithmetic.

`supabase/functions/*/index.ts` are excluded from `tsconfig.json` (Deno globals, `npm:`
specifiers). Their *pure* layer stays inside `npm run typecheck` deliberately.

### Money invariants

- **Integer minor units everywhere.** Never float, never `numeric` into a JS number. One
  `formatMoney()` is the only place a number becomes a string. A hardening check asserts no
  money column is a non-integer type.
- **Transfers are two paired rows** sharing `transfer_group_id`; `transfer` is its own `type`,
  so spending aggregates exclude it *structurally* rather than by a filter someone must
  remember. Get this wrong and moving ₱5,000 to savings reads as ₱5,000 spent.
- **`Available Money` ≠ `Remaining`.** Balance − upcoming bills vs income − expenses. They
  answer different questions; conflating them was the original blocking defect (P1).
- **Dates are local.** Use `todayISO()` / `parseISODate()`. `new Date().toISOString().slice(0,10)`
  files an evening purchase to the previous day in any positive-offset zone, and the DB column
  default is UTC, so the client must always send the date explicitly.

### A database cascade is only half a change — the caches are the other half

TanStack Query caches are the app's real source of truth for what the user *sees*, and a
`ON DELETE CASCADE` fires where no client code is looking. Deleting an account cascades
`transactions` **and** `recurring_transactions`, and nulls `bills.account_id`; a mutation that
invalidates only the obvious ones leaves the screen showing rows the database no longer has.
That shipped once — deleting an account left its salary drawn on the calendar (M18).

Three rules follow, and none is enforced by a test:

- **`isLoading` is not "in flight".** It is false whenever the cache holds *any* data, including
  data you just invalidated and are about to replace. A redirect or an empty state gated on
  `!isLoading` fires against the stale value while the refetch is still running. Gate on
  `isFetching` as well — and where the consequence is navigation, `await refetchQueries` before
  you navigate rather than racing it. This shipped as onboarding running twice (M19): finishing
  it landed on a dashboard that read the pre-onboarding `[]` and bounced the user straight back.
- **When you add a cascading FK, grep for every query key that reads the child table** and add
  it to the parent mutation's `onSuccess`.
- **The same table is read under more than one key**, in different shapes.
  `recurring_transactions` is `['recurring-income-schedule']` (array, calendar) *and*
  `['insights','recurring-income']` (summed number, dashboard). Invalidate both. They are
  deliberately separate keys — sharing one crashed the dashboard with "recurringIncome is not
  iterable", which is documented at `qkCalendar.recurringIncomeSchedule`.

The mirror of this: **a lifecycle flag the database honours, the client queries must honour
too.** `generate_due_recurring()` skips schedules whose account is archived, so the calendar and
dashboard queries carry the matching `accounts!inner(archived_at)` filter. If those two disagree,
the UI draws income that will never arrive.

### Derived, never stored

Bill due dates and paydays are projected from the tables that own them — copying them into
`calendar_events` would let the calendar disagree with the ledger. The same rule keeps `budgets`
free of a bills column, and makes work schedules a **recurrence rule** rather than generated
rows. A DB check asserts `budgets` never grows a bills column.

Exceptions to a recurring rule are *rows*, not edits (`bill_payments`, `work_shift_exceptions`) —
"I swapped Tuesday" is what a mutable flag cannot express.

### AI: two gates, both server-side

Read tools need no grant. The three write tools (`create_task`, `create_reminder`,
`create_calendar_event`) need **a grant** (absence = denied) **and the user's confirmation** — a
granted call is *proposed*, never executed, and both grant and arguments are re-checked when the
confirmation arrives. The database refuses to store a grant for anything touching money.

The Edge Function builds its Supabase client from the **caller's JWT, never the service role**,
so RLS is the enforcement rather than a `where` clause. `generate_due_recurring()` runs on every
dashboard mount and is idempotent via a unique index — never replace that with a client-side
read-modify-write on `next_run`.

**No AI feature has ever called a model.** There is no `supabase/functions/.env` here, so every
guard *around* the call is verified — 401 unauthenticated, 403 switched off, 403 ungranted, 503
unconfigured, in that order — and the call itself is not. The tool loop, the payloads a model
actually receives, the D§30 shape of a real reply, and the confirm-an-action round trip are all
unexercised. Treat that layer as unproven, and before building on it:

```bash
echo "OPENAI_API_KEY=sk-..." > supabase/functions/.env && npx supabase functions serve
```

## Verification

Gates in order — each catches a distinct class, cost climbs steeply:
typecheck → unit tests → DB suites → web → **device**.

The web gate is where two whole classes get *measured* rather than assumed, and neither is
visible to typecheck:

- **Contrast and touch targets**, by walking the rendered DOM and compositing each element's
  real background stack. Run it in **both themes** — the theme is a saved preference in
  `localStorage['savi.theme-preference']`, so `prefers-color-scheme` alone will not flip it.
  Note the auditor cannot see `hitSlop`, so `sm` buttons will always report 40px; that one is
  deliberate and documented at `Button.tsx`.
- **PostgREST behaviour.** An embedded filter like `accounts!inner(archived_at)` compiles fine
  and can silently return everything. Check the actual request in the network log, or curl it
  with a real user JWT and a fixture in both states.

**Nothing is done until it has run on a device.** Three consecutive milestones shipped bugs that
passed typecheck, every test, and a full web pass, and were only found by tapping the app —
`transform: undefined` crashing every button press, FlashList silently dropping new rows, a
fresh install sending users to system settings for a permission never requested. The pattern is
always the same: the reasoning was written down correctly and the implementation quietly
diverged, in a way `react-native-web` tolerates and native does not.
