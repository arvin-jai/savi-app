/**
 * Ask Savi — the AI assistant Edge Function (v0.4 / M10).
 *
 * This function exists for one reason above all others: **the API key must
 * never reach the client.** An Android APK is public, and a key in a bundle is
 * a published key. `App → Edge Function → OpenAI` (P§31, AI-BOUNDARY §2.1).
 *
 * Read docs/AI-BOUNDARY.md before changing anything here. The order of the
 * guards below is deliberate — auth, then the user's off switch, then anything
 * that costs money or crosses the boundary:
 *
 *   1. §2.2  Reject without a JWT. 401 before any query runs.
 *   2. §2.2  Build the Supabase client from the CALLER's JWT, never the service
 *            role key, so RLS is the enforcement rather than a `where` clause
 *            somebody has to remember.
 *   3. §4    Refuse if the user has switched Ask Savi off — server-side, so a
 *            stale client cannot send their data after they said no.
 *   4. §5    Dispatch only against the six read-only tools. There is no write
 *            tool to hijack; that is what makes injection inert (§6.2).
 *   5. §7    Every figure is computed by SQL and formatted before it crosses.
 *            The model interprets numbers; it never produces them.
 *
 * Deno runtime. The pure logic lives in ./tools.ts and ./prompt.ts so it is
 * unit-testable by jest without a network — this file is I/O and orchestration
 * only, which is the same split the rest of the codebase uses (api.ts vs the
 * pure layer).
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  isWriteToolName,
  validateAction,
  WRITE_TOOL_SCHEMAS,
  type ProposedAction,
  type WriteToolName,
} from './actions.ts';
import { MAX_HISTORY_MESSAGES, MAX_TOOL_ROUNDS, SYSTEM_PROMPT } from './prompt.ts';
import {
  billStatusFor,
  clampLimit,
  computeFreeDates,
  isToolName,
  nextBillDueDate,
  periodForISO,
  projectBills,
  projectBudget,
  projectExpenses,
  projectGoals,
  projectMonthlySpending,
  projectSchedule,
  projectSummary,
  resolveMonth,
  resolveRange,
  TOOL_SCHEMAS,
  type ScheduleItem,
} from './tools.ts';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Overridable so the model can be changed without a redeploy of logic, and so
 * a cheaper model can be used in development. Tool calling is required.
 */
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Errors reach users, so they get plain language (D§58, P§63) while the detail
 * goes to the logs. "Savi couldn't reach its assistant right now" is honest and
 * actionable; a raw upstream error is neither.
 */
function fail(userMessage: string, status: number, logDetail?: unknown): Response {
  if (logDetail !== undefined) console.error(userMessage, logDetail);
  return json({ error: userMessage }, status);
}

// ─── Today, in the user's local terms ───────────────────────────────────────
//
// The client sends its own date. The server's `current_date` is UTC, and an
// evening purchase in Manila (UTC+8) files to the previous day under UTC — the
// exact bug lib/dates.ts exists to prevent, and which M3 shipped once already.
// If the client does not send one, fall back to UTC and accept the edge case
// rather than inventing a timezone for the user.
function resolveToday(supplied: unknown): string {
  return typeof supplied === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(supplied)
    ? supplied
    : new Date().toISOString().slice(0, 10);
}

// ─── Tool execution ─────────────────────────────────────────────────────────

type ToolContext = { db: SupabaseClient; today: string };

/**
 * Every branch is a READ. Adding a write here is a v0.6 decision that also
 * requires `ai_tool_grants` enforced in this function and per-action user
 * confirmation — see AI-BOUNDARY §5.3. Do not add one without that.
 */
async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { db, today } = ctx;

  switch (name) {
    case 'get_financial_summary': {
      const month = resolveMonth(args.month, today);
      const { data, error } = await db.rpc('financial_summary', { p_period: month });
      if (error) throw error;
      return projectSummary(data?.[0] ?? null, month);
    }

    case 'get_upcoming_bills': {
      const bills = await loadBillsWithStatus(db, today);
      // Paid bills are not "upcoming". The status is derived from bill_payments
      // rather than a mutable flag, which is what makes undo and payment
      // history possible (M4).
      return projectBills(bills.filter((b) => b.status !== 'paid'));
    }

    case 'get_recent_expenses': {
      const limit = clampLimit(args.limit);
      const { data, error } = await db
        .from('transactions')
        .select('description, amount_minor, currency, transaction_date, classification, category:categories(name)')
        .eq('type', 'expense')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return projectExpenses((data ?? []) as never);
    }

    case 'get_monthly_spending': {
      const month = resolveMonth(args.month, today);
      // Summed in SQL, not here and certainly not by the model (§7).
      const { data, error } = await db.rpc('monthly_spending_by_category', { p_month: month });
      if (error) throw error;
      return projectMonthlySpending(data ?? [], month);
    }

    case 'get_financial_goals': {
      const { data, error } = await db
        .from('financial_goals')
        .select('name, target_minor, saved_minor, currency, target_date')
        .is('archived_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // The monthly figure is computed here, never left to the model (§7).
      return projectGoals(data ?? [], today);
    }

    case 'get_budget': {
      const month = resolveMonth(args.month, today);

      const [budget, split, saved, summary] = await Promise.all([
        db
          .from('budgets')
          .select('income_minor, needs_minor, wants_minor, savings_minor')
          .eq('period', month)
          .maybeSingle(),
        db.rpc('spending_by_classification', { p_month: month }),
        db.rpc('saved_to_savings_minor', { p_month: month }),
        db.rpc('financial_summary', { p_period: month }),
      ]);

      if (split.error) throw split.error;
      if (saved.error) throw saved.error;

      const rows = (split.data ?? []) as { classification: string; total_minor: number }[];
      const by = (k: string) => rows.find((r) => r.classification === k)?.total_minor ?? 0;

      return projectBudget(
        budget.data ?? null,
        // Derived, exactly as the budget screen does it — the bills table owns
        // this number and the plan never stores it.
        summary.data?.[0]?.upcoming_bills_minor ?? 0,
        {
          billsMinor: by('bill'),
          needsMinor: by('need'),
          wantsMinor: by('want'),
          savingsMinor: (saved.data as number | null) ?? 0,
        },
        month
      );
    }

    case 'get_schedule':
      return await loadSchedule(db, args, today);

    case 'get_free_time': {
      const range = resolveRange(args.start, args.end, today);
      const scheduled = await loadSchedule(db, args, today);
      return { ...range, free_dates: computeFreeDates(scheduled, range) };
    }

    default:
      // Unreachable: isToolName() gates dispatch before we get here.
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Bills with their derived due date and status.
 *
 * Due dates are computed, never read from a stored column, and never taken from
 * calendar_events — the calendar's money entries are themselves derived (M8).
 * One rule, one place it can be wrong.
 */
async function loadBillsWithStatus(db: SupabaseClient, today: string) {
  const period = periodForISO(today);

  const [{ data: bills, error: billErr }, { data: payments, error: payErr }] = await Promise.all([
    db.from('bills').select('id, name, amount_minor, currency, due_day, recurrence').is('archived_at', null),
    db.from('bill_payments').select('bill_id, period'),
  ]);
  if (billErr) throw billErr;
  if (payErr) throw payErr;

  const paidByBill = new Map<string, Set<string>>();
  for (const p of payments ?? []) {
    const set = paidByBill.get(p.bill_id) ?? new Set<string>();
    set.add(p.period);
    paidByBill.set(p.bill_id, set);
  }

  return (bills ?? []).map((b) => {
    const paidPeriods = paidByBill.get(b.id) ?? new Set<string>();
    const dueDate = nextBillDueDate(b, paidPeriods, today);
    return {
      name: b.name,
      amount_minor: b.amount_minor,
      currency: b.currency,
      due_date: dueDate,
      status: billStatusFor(dueDate, paidPeriods.has(period), today),
    };
  });
}

/** Money and time on one surface (P§35) — events, tasks, and bill due dates. */
async function loadSchedule(
  db: SupabaseClient,
  args: Record<string, unknown>,
  today: string
): Promise<ScheduleItem[]> {
  const range = resolveRange(args.start, args.end, today);

  const [{ data: events, error: evErr }, { data: tasks, error: taskErr }] = await Promise.all([
    db
      .from('calendar_events')
      .select('title, event_date, kind, all_day')
      .gte('event_date', range.start)
      .lte('event_date', range.end),
    db.from('tasks').select('title, due_date, priority, status').not('due_date', 'is', null),
  ]);
  if (evErr) throw evErr;
  if (taskErr) throw taskErr;

  const bills = (await loadBillsWithStatus(db, today))
    .filter((b) => b.status !== 'paid' && b.due_date !== null)
    .map((b) => ({
      name: b.name,
      amount_minor: b.amount_minor,
      currency: b.currency,
      due_date: b.due_date as string,
    }));

  return projectSchedule(events ?? [], tasks ?? [], bills, range);
}

// ─── Grants and confirmed writes (v0.6) ─────────────────────────────────────

/** The tools this user has actually granted. Absence means denied. */
async function loadGrants(db: SupabaseClient, userId: string): Promise<Set<WriteToolName>> {
  const { data, error } = await db
    .from('ai_tool_grants')
    .select('tool_name')
    .eq('user_id', userId);

  // Fail CLOSED. If the grants cannot be read we grant nothing, rather than
  // letting a transient database error open write access.
  if (error) {
    console.error('Failed to load tool grants; treating as none granted', error);
    return new Set();
  }

  const granted = new Set<WriteToolName>();
  for (const row of data ?? []) {
    if (isWriteToolName(row.tool_name)) granted.add(row.tool_name);
  }
  return granted;
}

/**
 * Execute an action the user has confirmed.
 *
 * Every guard from the proposal phase runs again. The client is the user's own
 * app and RLS scopes every write to them, so the worst a tampered payload can
 * do is write to their own account — but "the worst case is bounded" is not a
 * reason to skip the check.
 */
async function executeConfirmedAction(
  db: SupabaseClient,
  userId: string,
  raw: unknown,
  today: string
): Promise<Response> {
  const candidate = raw as { tool?: unknown; args?: unknown };
  const tool = typeof candidate.tool === 'string' ? candidate.tool : '';
  const args =
    candidate.args && typeof candidate.args === 'object'
      ? (candidate.args as Record<string, unknown>)
      : {};

  if (!isWriteToolName(tool)) {
    return fail('Savi cannot do that.', 400, `Confirmed unknown tool: ${tool}`);
  }

  // Re-check the grant. A revocation between proposal and confirmation wins.
  const granted = await loadGrants(db, userId);
  if (!granted.has(tool)) {
    return fail(
      "Savi doesn't have permission to do that. You can grant it in Settings.",
      403
    );
  }

  // Re-validate. The server does not take the client's word for what it agreed to.
  const validation = validateAction(tool, args, today);
  if (!validation.ok) {
    return fail(`Savi couldn't do that: ${validation.error}`, 400);
  }

  const action = validation.action;

  let resultId: string | null = null;
  let succeeded = false;
  let userMessage: string;

  try {
    if (tool === 'create_task' || tool === 'create_reminder') {
      const { data, error } = await db
        .from('tasks')
        .insert({
          user_id: userId,
          title: action.args.title,
          due_date: action.args.due_date ?? null,
          priority: action.args.priority ?? 'medium',
        })
        .select('id')
        .single();
      if (error) throw error;
      resultId = data.id;
    } else {
      const { data, error } = await db
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: action.args.title,
          event_date: action.args.event_date,
          kind: action.args.kind,
          all_day: !action.args.start_time,
          start_time: action.args.start_time ?? null,
          end_time: action.args.end_time ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      resultId = data.id;
    }

    succeeded = true;
    userMessage = 'Done.';
  } catch (err) {
    console.error(`Confirmed action ${tool} failed`, err);
    userMessage = "Savi couldn't save that. Nothing was changed.";
  }

  // Log either way. An action the user confirmed that then FAILED is exactly
  // the thing worth being able to see later.
  await db.from('ai_action_log').insert({
    user_id: userId,
    tool_name: tool,
    arguments: action.args,
    result_id: resultId,
    succeeded,
  });

  return json({ executed: succeeded, reply: userMessage, action });
}

// ─── The request ────────────────────────────────────────────────────────────

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail('Method not allowed.', 405);

  // ── 1. Auth (AI-BOUNDARY §2.2) ────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('You need to be signed in to ask Savi.', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    return fail('Savi is not configured correctly.', 500, 'Missing SUPABASE_URL/ANON_KEY');
  }

  // ── 2. The caller's JWT, never the service role key ───────────────────────
  // Every query below therefore runs as this user and RLS applies exactly as it
  // does from the app. A bug in a tool's filter cannot leak another user's rows.
  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await db.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return fail('Your session has expired. Sign in again.', 401, userErr);

  // ── 3. The off switch, enforced server-side (AI-BOUNDARY §4) ──────────────
  const { data: prefs } = await db
    .from('ai_preferences')
    .select('enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  // Absent row → treat as off. The trigger seeds one for every user, so a
  // missing row means something is wrong, and "fail closed" is the only safe
  // direction when the question is whether to send someone's finances onward.
  if (!prefs?.enabled) {
    return fail('Ask Savi is switched off. You can turn it back on in Settings.', 403);
  }

  // ── 3b. Only now, configuration ───────────────────────────────────────────
  // Deliberately AFTER identity and consent. A missing key is an operator
  // problem, and answering it first would mean a user who has switched Ask Savi
  // off is told "not configured" instead of being refused — which makes the
  // §4 guarantee untestable in any environment without a key.
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    // Vague to the user, specific in the logs. Never echo configuration.
    return fail("Savi's assistant isn't configured yet.", 503, 'Missing OPENAI_API_KEY secret');
  }

  // ── 4. Input ──────────────────────────────────────────────────────────────
  let body: {
    message?: unknown;
    conversationId?: unknown;
    today?: unknown;
    confirm?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail('That message could not be read.', 400);
  }

  // ── 4b. Confirmed action (v0.6) ───────────────────────────────────────────
  // The second half of the two-phase write. The first request PROPOSED this;
  // the user has now approved it, so this is where it actually happens.
  //
  // The grant is re-checked here, not trusted from the first phase: a user can
  // revoke between the proposal and the confirmation, and the revocation has to
  // win. Re-validating the arguments matters for the same reason — this request
  // came from a client, and the server does not take a client's word for what
  // it agreed to write.
  if (body.confirm !== undefined && body.confirm !== null) {
    return await executeConfirmedAction(
      db,
      user.id,
      body.confirm,
      resolveToday(body.today)
    );
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return fail('Ask Savi a question to get started.', 400);
  if (message.length > 2000) return fail('That question is a bit long. Try shortening it.', 400);

  const today = resolveToday(body.today);

  // ── 5. Conversation ───────────────────────────────────────────────────────
  let conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;

  if (conversationId) {
    // RLS already prevents reading someone else's thread; this turns a silent
    // "no history" into an explicit error rather than answering with a blank slate.
    const { data: existing } = await db
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const { data: created, error: createErr } = await db
      .from('ai_conversations')
      .insert({ user_id: user.id, title: message.slice(0, 80) })
      .select('id')
      .single();
    if (createErr || !created) {
      return fail("Savi couldn't start that conversation.", 500, createErr);
    }
    conversationId = created.id;
  }

  const { data: history } = await db
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  const priorTurns: ChatMessage[] = (history ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Persist the question before calling out. If the model call fails, the user
  // still sees what they asked rather than a thread that silently ate it.
  const { error: insertErr } = await db.from('ai_messages').insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: 'user',
    content: message,
  });
  if (insertErr) return fail("Savi couldn't save that message.", 500, insertErr);

  // ── 6. The tool loop ──────────────────────────────────────────────────────
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...priorTurns,
    { role: 'user', content: message },
  ];

  let reply = '';
  // Set when the model proposes a write. The action is NOT executed here — it
  // goes back to the client, gets rendered, and runs only if the user confirms.
  let pendingAction: ProposedAction | null = null;

  // Only granted write tools are offered to the model at all. An ungranted tool
  // is not "offered and refused"; the model never sees it, so it cannot suggest
  // something the user would then have to decline.
  const grantedTools = await loadGrants(db, user.id);
  const writeSchemas = WRITE_TOOL_SCHEMAS.filter((s) =>
    grantedTools.has(s.function.name as WriteToolName)
  );

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      // On the last round drop the tools entirely, forcing an answer from what
      // has already been gathered instead of a reply that is only another tool
      // request the loop will discard.
      const offerTools = round < MAX_TOOL_ROUNDS;

      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          ...(offerTools
            ? { tools: [...TOOL_SCHEMAS, ...writeSchemas], tool_choice: 'auto' }
            : {}),
          temperature: 0.3,
          max_tokens: 700,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        return fail("Savi couldn't reach its assistant right now. Try again in a moment.", 502, detail);
      }

      const completion = await res.json();
      const choice = completion.choices?.[0]?.message;
      if (!choice) {
        return fail("Savi couldn't work out an answer to that.", 502, completion);
      }

      const toolCalls = choice.tool_calls ?? [];

      if (toolCalls.length === 0) {
        reply = (choice.content ?? '').trim();
        break;
      }

      messages.push({ role: 'assistant', content: choice.content ?? null, tool_calls: toolCalls });

      for (const call of toolCalls) {
        const name = call.function?.name ?? '';

        let args: Record<string, unknown> = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }

        // ── Write tools (v0.6) ────────────────────────────────────────────
        // Two gates, both here, both server-side: the grant, then the user's
        // confirmation. Nothing is written in this request.
        if (isWriteToolName(name)) {
          if (!grantedTools.has(name)) {
            // Should be unreachable — an ungranted tool was never offered — but
            // a model can emit any string, and "unreachable" is not a permission
            // check.
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({
                error:
                  'You do not have permission for that. Tell the user they can grant it in Settings.',
              }),
            });
            continue;
          }

          const validation = validateAction(name, args, today);
          if (!validation.ok) {
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: validation.error }),
            });
            continue;
          }

          // One proposal per reply. Two pending confirmations in a single card
          // is a UI that gets mis-tapped, and these are writes.
          if (!pendingAction) pendingAction = validation.action;

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              status: 'awaiting_user_confirmation',
              summary: validation.action.summary,
              instruction:
                'Nothing has been saved yet. Tell the user what you are about to do, in one ' +
                'sentence, and that they need to confirm it. Do not claim it is done.',
            }),
          });
          continue;
        }

        // ── The read allowlist (AI-BOUNDARY §5.2) ─────────────────────────
        // A name that is neither a read tool nor a granted write tool is
        // refused here. The refusal goes back to the model as a tool result so
        // it can recover and answer, rather than the request failing.
        if (!isToolName(name)) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              error: `No such tool: ${name}. Savi cannot move money, delete anything, or change existing records.`,
            }),
          });
          continue;
        }

        try {
          const result = await runTool(name, args, { db, today });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          console.error(`Tool ${name} failed`, err);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: 'That information could not be loaded.' }),
          });
        }
      }
    }
  } catch (err) {
    return fail("Savi couldn't reach its assistant right now. Try again in a moment.", 502, err);
  }

  if (!reply) {
    return fail("Savi couldn't work out an answer to that. Try rephrasing?", 502);
  }

  // ── 7. Persist the answer ─────────────────────────────────────────────────
  const { error: replyErr } = await db.from('ai_messages').insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: 'assistant',
    content: reply,
  });
  // A failure here loses the answer from the transcript but not from this
  // response, so the user still gets it. Log and continue rather than 500 on
  // an answer we already have.
  if (replyErr) console.error('Failed to persist assistant reply', replyErr);

  await db
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // `pendingAction` is a PROPOSAL. Nothing has been written; the client renders
  // it and the user decides (P§30 Phase 8).
  return json({ conversationId, reply, pendingAction });
});
