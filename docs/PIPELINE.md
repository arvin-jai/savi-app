# Savi — Development Pipeline

**Last updated:** 2026-08-15

How work gets from an idea to something verified. Companion to
[HAND-OFF.md](HAND-OFF.md) (state and gotchas) and [BUILD-PLAN.md](BUILD-PLAN.md) (scope).

---

## The one lesson worth reading

**Three consecutive milestones shipped bugs that passed every automated gate and were only
found by running the app on a device.**

| Bug | Passed | Caught by |
| --- | --- | --- |
| `transform: undefined` crashed **every button press** | typecheck, 105 tests, full web pass | tapping a button on Android |
| FlashList silently dropped new rows to the bottom | typecheck, tests, web | adding a transaction and looking |
| Fresh install sent users to system settings for a permission never requested | typecheck, tests | opening Settings on a device |

The pattern is identical every time: **the reasoning was written down correctly and the
implementation quietly diverged**, in a way `react-native-web` tolerates and native does not.

The automated gates are necessary and they are not sufficient. **A milestone is not done until
it has run on a device.**

---

## Environment

| Requirement | Version used | Notes |
| --- | --- | --- |
| Node | 22.x | |
| Docker Desktop | running | Local Supabase |
| Android SDK + JDK 17 | `ANDROID_HOME` set | AVD used: `Pixel_9_Pro_XL` |
| Supabase CLI | via `npx` | |

`.env` needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Copy
`.env.example`. `npx supabase start` prints the local values.

---

## Cold start, in order

Order matters — Metro's dev client defaults to **8081**, so start Supabase first and don't let
the web preview take that port when you want a device.

```bash
# 1. Backend
npx supabase start
npx supabase migration up

# 2. Emulator (or plug in a device)
"$ANDROID_HOME/emulator/emulator.exe" -avd Pixel_9_Pro_XL -no-snapshot-load -no-audio

# 3. Port forwards — BOTH of them
adb reverse tcp:8081 tcp:8081
adb reverse tcp:54321 tcp:54321     # ← forget this and the app hangs, then shows Welcome

# 4. Metro
npx expo start --dev-client --port 8081
```

Then launch:

```bash
adb shell am start -a android.intent.action.VIEW -d "savi://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

**Web instead:** `npm run web` — but it also wants 8081, so run one or the other.

---

## The verification ladder

Each gate is cheap and catches a distinct class. Run them in order; the cost climbs steeply at
the bottom.

### 1. Typecheck — seconds

```bash
npm run typecheck
npx deno check supabase/functions/*/index.ts   # the two files tsc cannot see
```

Catches: signature drift, schema/type mismatch, missing enum cases.
**Misses:** everything about runtime behaviour.

> The Edge Function's entry point is excluded from `tsconfig.json` — `Deno.env`, `Deno.serve`
> and `npm:` specifiers are not resolvable by the app's config. Its *pure* layer (`tools.ts`,
> `money.ts`, `prompt.ts`) stays inside `npm run typecheck` deliberately, because that is where
> the logic worth checking lives. Run the `deno check` line above after touching `index.ts`.

### 2. Unit tests — seconds

```bash
npm test
```

385 tests over the pure layer: `money`, `dates`, `crashReport`, `bills/schedule`,
`calendar/timeline`, `insights/rules`, `notifications/schedule`, `budgets/waterfall`,
`goals`, `transactions/trend`, `calendar/shifts`, `calendar/week`, `theme/colorVision`, `ai/message`, and the Edge Function's `ai-assistant/tools` and `ai-assistant/actions`.

Catches: arithmetic, date boundaries, scheduling rules, merge ordering, calm-voice copy, and
what may cross the AI boundary.
**Misses:** anything touching the DB, the network, or a native surface.

> **Contract tests.** The Edge Function runs in Deno and cannot import `@/lib/money` or
> `@/features/bills/schedule`, so those rules are mirrored inside `supabase/functions/`. The
> mirrors are not trusted: `tools.test.ts` runs both implementations over the same cases, so
> drift fails the suite rather than shipping two different answers about money. Add a case to
> both sides when either rule changes.

> **Where to put logic so this gate can see it.** Every non-trivial decision belongs in a pure
> function with typed inputs, in its own file, with no I/O — that is why `schedule.ts`,
> `timeline.ts`, and `rules.ts` exist separately from their `api.ts`. If a rule can only be
> tested by rendering a screen, it is in the wrong file.

### 3. Database suites — ~30s, needs Supabase up

```bash
npm run db:test            # money engine: RLS isolation, transfers, P§23 formulas
npm run db:test:calendar   # calendar, tasks, notification preferences
npm run db:test:ai         # ai_* tables: isolation, transcript rules, spending aggregate
npm run db:test:budgets    # budgets, goals, the two waterfall aggregates
npm run db:test:shifts     # work schedules and shift exceptions
npm run db:test:recurring  # recurring income generation and its idempotency
npm run db:test:grants     # AI tool permissions and the action log
npm run db:test:hardening  # P§30 Phase 10, plus schema-wide invariants
npm run db:test:all        # all eight — 121 checks
```

> **Two of the hardening checks are schema-wide**, and they are the ones worth protecting:
> every money column must be an integer type, and every public table must have RLS *and* at
> least one policy. A new table added later without a policy fails the suite instead of
> shipping.

Catches: RLS leaks, missing grants, constraint gaps, engine arithmetic, cross-user isolation.
**Misses:** anything above the database.

These run as real Postgres roles with real JWT claims. They assert an actual second user
*cannot* see the first user's rows — not that a policy string exists.

### 4. Web — minutes

```bash
npm run web
```

Fast iteration, real DOM, and the only place the contrast auditor runs (see below).
Catches: layout, responsive behaviour, contrast, keyboard focus.
**Misses:** **the entire native-only bug class.** See the table at the top.

### 5. Device — the gate that actually decides

Nothing is done until this passes. See [Device verification](#device-verification).

---

## Device verification

The sequence that works, after any change that touches a screen:

```bash
# Reload JS only (no rebuild needed for JS/TS changes)
adb shell am force-stop com.anonymous.Savi
adb shell am start -a android.intent.action.VIEW -d "savi://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

# Look at it
adb exec-out screencap -p > shot.png

# Read the screen as text (faster than eyeballing)
adb shell uiautomator dump /sdcard/u.xml && adb shell cat /sdcard/u.xml | grep -o 'text="[^"]*"'

# JS errors surface in the Metro log, not logcat
tail -f <metro-output>
adb logcat -d | grep -i ReactNativeJS
```

**When a native dependency is added**, JS reload is not enough:

```bash
npx expo prebuild --platform android
npx expo run:android          # ~20 min cold
```

**Interacting:** `adb shell input tap X Y` — coordinates are in the **raw framebuffer**
(1344×2992 on this AVD), so multiply the coordinates of a scaled screenshot by 1.5.

**Verifying OS-level behaviour** (this is how M9 was closed):

```bash
adb shell dumpsys alarm | grep -i savi -A2                   # is it scheduled?
adb shell dumpsys notification --noredact | grep -A20 NotificationRecord.*Savi
adb shell cmd statusbar expand-notifications                 # then screencap
```

---

## Running Ask Savi locally

The API key is a **server-side secret** and never appears in `.env` or any `EXPO_PUBLIC_*`
variable — an Android APK is public, so a key in the bundle is a published key
([AI-BOUNDARY §2.1](AI-BOUNDARY.md)).

```bash
# supabase/functions/.env  (gitignored — `.env` is ignored at any depth)
echo "OPENAI_API_KEY=sk-..." > supabase/functions/.env

npx supabase functions serve          # serves ALL functions; takes no name argument
```

Then the app reaches it at `http://127.0.0.1:54321/functions/v1/ai-assistant`. For a device,
`adb reverse tcp:54321 tcp:54321` already covers it — same port as the rest of Supabase.

**Verify the guard order without a key.** These three are the security contract, and all of
them are observable before OpenAI is ever involved:

```bash
URL=http://127.0.0.1:54321/functions/v1/ai-assistant

# 401 — no Authorization header
curl -s -w '\n%{http_code}\n' -X POST $URL -H 'Content-Type: application/json' -d '{"message":"hi"}'

# 403 — authenticated, but the user has Ask Savi switched off
# 503 — authenticated and allowed, but no OPENAI_API_KEY
curl -s -w '\n%{http_code}\n' -X POST $URL -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"message":"hi","today":"2026-08-15"}'
```

Configuration is checked **last**, deliberately: it is an operator problem, and answering it
first makes the off-switch guarantee untestable in any environment without a key.

---

## Adding a schema change

One migration contains **all four** of these. Splitting them is how M2 shipped tables that
were RLS-correct and completely inaccessible.

```sql
create table public.thing (...);          -- 1. table + constraints
alter table public.thing enable row level security;
create policy "thing: read own"  on public.thing for select using (auth.uid() = user_id);
create policy "thing: write own" on public.thing for insert with check (auth.uid() = user_id);
grant select, insert, update, delete on public.thing to authenticated;   -- 2. GRANTS
```

3. Add the row type to `lib/database.types.ts` **and** register it in the `Tables` map.
4. Extend a suite in `supabase/tests/` — at minimum: a second user sees nothing, and every
   `check` constraint rejects what it should.

Then:

```bash
npx supabase migration up
npm run db:test:all
```

**Scope DB assertions to fixture ids, not global counts.** `select count(*) from profiles`
passes on a fresh reset and fails the moment real data exists.

---

## Definition of done

A milestone is done when **all** of these hold:

- [ ] `npm run typecheck` clean
- [ ] `npx deno check supabase/functions/*/index.ts` clean, if an Edge Function changed
- [ ] `npm test` green, with new pure logic covered
- [ ] `npm run db:test:all` green, if the schema changed
- [ ] Runs on **web** without console errors
- [ ] **Runs on a device** — the specific flow exercised by hand, not assumed
- [ ] BUILD-PLAN.md updated with what was built **and what broke**
- [ ] Anything unverified is written down as unverified, not implied to be fine

That last one matters. Every milestone record in BUILD-PLAN.md carries an explicit "still
outstanding" list, and that is why the open items in HAND-OFF.md are trustworthy.

---

## Contrast auditing

The design system's accessibility claims are checked programmatically, not by eye. In a
browser on `/dev/kitchen-sink`, the auditor walks every text node, composites the real
background stack (including translucent glass), and reports failures per theme.

The full script is in the M6 record in [BUILD-PLAN.md](BUILD-PLAN.md). The key rules it
encodes:

- Composite the **whole** ancestor background stack — a translucent card over an ambient orb
  has no single contrast value.
- Thresholds are size-aware: 3:1 for ≥24px or ≥18.66px bold, else 4.5:1.
- Elements with `hitSlop` are excluded from the touch-target check; the DOM can't see it.

`/dev/kitchen-sink` renders every primitive in every state in both themes and **stays in the
repo permanently** — it is how each new component gets reviewed.

---

## Version ladder

From P§37. "MVP" meant three different things across the product spec; this is the operative
sequence.

```
v0.1  Money foundation        ✅  auth · accounts · transactions · bills · dashboard
v0.2  Calendar & Tasks        ✅  the money+time timeline
v0.3  Notifications           ✅  local reminders
v0.4  Ask Savi (read-only)    ✅  read-only tools · boundary documented first
v0.5  AI Insights · Budgets · Goals  ✅  waterfall · goals · model-written insights
v0.6  AI Actions              ✅  per-tool grants, always confirmed
v0.7  Hardening               ✅  P§30 Phase 10 executed — 17 checks
v1.0  Public MVP              ⛔  blocked — see RELEASE.md

⚠ No AI feature has called a model yet. Needs OPENAI_API_KEY.
⚠ No device pass since v0.3.
```

Two ordering constraints that are not negotiable:

1. **P§33 — do not build the AI first.** Every AI milestone sits on a calculation engine
   already tested against real transactions.
2. **Read-only until v0.6.** The AI never moves money, deletes a transaction, or takes an
   irreversible financial action.

---

## Not yet built

**There is no CI.** Every gate above is run by hand. The cheap first step is a GitHub Actions
workflow running `typecheck` + `test` on push — those need no Docker and no device. The DB
suites need a Supabase service container; the device gate can't be automated here at all and
should stay a human step.

**There is no release pipeline.** v1.0 needs EAS build config, a web deploy target, crash
reporting, and a privacy policy — the app holds financial data and (from v0.4) sends derived
summaries to a model.
