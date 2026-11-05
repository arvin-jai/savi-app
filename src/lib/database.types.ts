/**
 * Database types.
 *
 * Hand-written to match supabase/migrations/*.sql. Regenerate with:
 *   npx supabase gen types typescript --local > src/lib/database.types.ts
 *
 * Money is `number` here because Supabase returns bigint as a JS number over
 * the wire. Every value is MINOR UNITS — see lib/money.ts. A value in this file
 * should never reach a UI without passing through formatMoney().
 */

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'savings' | 'credit_card';
export type TxnType = 'income' | 'expense' | 'transfer';
export type TxnDirection = 'in' | 'out';
export type Classification = 'need' | 'want' | 'bill';
export type Recurrence = 'monthly' | 'weekly' | 'yearly' | 'none';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'done';
export type EventKind = 'work' | 'personal' | 'appointment' | 'deadline';

export type Profile = {
  id: string;
  display_name: string | null;
  currency: string;
  /**
   * When onboarding was completed; null means never. Server-side on purpose —
   * it has to survive a reinstall and follow the user to a second device,
   * which is what an empty account list cannot tell you (see the migration
   * 20260817000100 and `features/onboarding/status.ts`).
   */
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance_minor: number;
  currency: string;
  is_liability: boolean;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string | null;
  name: string;
  slug: string | null;
  icon: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  amount_minor: number;
  currency: string;
  direction: TxnDirection;
  type: TxnType;
  classification: Classification | null;
  category_id: string | null;
  transfer_group_id: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
};

export type Bill = {
  id: string;
  user_id: string;
  name: string;
  amount_minor: number;
  currency: string;
  recurrence: Recurrence;
  due_day: number | null;
  /** How often, in months. 1 = monthly, 3 = quarterly, 12 = yearly. */
  interval_months: number;
  /**
   * First of the month of the first occurrence — WHICH months the interval
   * lands in. Null only for monthly bills, where it carries no information.
   */
  anchor_month: string | null;
  category_id: string | null;
  account_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BillPayment = {
  id: string;
  user_id: string;
  bill_id: string;
  period: string;
  paid_at: string;
  transaction_id: string | null;
  created_at: string;
};

export type RecurringTransaction = {
  id: string;
  user_id: string;
  account_id: string;
  amount_minor: number;
  currency: string;
  direction: TxnDirection;
  type: TxnType;
  classification: Classification | null;
  category_id: string | null;
  description: string | null;
  recurrence: Recurrence;
  day_of_month: number | null;
  next_run: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  kind: EventKind;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * P§28 — stored as a recurrence RULE, never as generated rows. See the
 * migration for the decision and `features/calendar/shifts.ts` for the
 * expansion.
 */
export type WorkSchedule = {
  id: string;
  user_id: string;
  name: string;
  /** 0 = Sunday … 6 = Saturday, matching JS getDay(). */
  days_of_week: number[];
  start_time: string | null;
  end_time: string | null;
  effective_from: string;
  effective_to: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkShiftExceptionKind = 'skipped' | 'moved';

/** One date on which the rule did not apply as written. */
export type WorkShiftException = {
  id: string;
  user_id: string;
  schedule_id: string;
  shift_date: string;
  kind: WorkShiftExceptionKind;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

export type NotificationPreferencesRow = {
  user_id: string;
  enabled: boolean;
  bills_enabled: boolean;
  tasks_enabled: boolean;
  events_enabled: boolean;
  income_enabled: boolean;
  bill_lead_days: number;
  remind_at: string;
  created_at: string;
  updated_at: string;
};

/** P§24 — the plan. Bills are NOT stored here; they are derived (see migration). */
export type Budget = {
  id: string;
  user_id: string;
  period: string;
  income_minor: number;
  needs_minor: number;
  wants_minor: number;
  savings_minor: number;
  created_at: string;
  updated_at: string;
};

export type FinancialGoal = {
  id: string;
  user_id: string;
  name: string;
  target_minor: number;
  saved_minor: number;
  currency: string;
  target_date: string | null;
  achieved_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Return shape of public.spending_by_classification(). */
export type ClassificationSpendRow = {
  classification: Classification;
  total_minor: number;
};

export type AiPreferencesRow = {
  user_id: string;
  enabled: boolean;
  disclosed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiConversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Only the two roles the user can see are stored. Tool calls and tool results
 * are ephemeral — see the migration, and AI-BOUNDARY §3.
 */
export type AiMessageRole = 'user' | 'assistant';

export type AiMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: AiMessageRole;
  content: string;
  created_at: string;
};

/**
 * The complete grantable set (v0.6). Enforced by a check constraint on the
 * table, and deliberately containing nothing that touches money — P§31 says
 * never, at any version.
 */
export const GRANTABLE_TOOLS = [
  'create_task',
  'create_reminder',
  'create_calendar_event',
] as const;
export type GrantableTool = (typeof GRANTABLE_TOOLS)[number];

export type AiToolGrant = {
  user_id: string;
  tool_name: GrantableTool;
  granted_at: string;
};

export type AiActionLogRow = {
  id: string;
  user_id: string;
  tool_name: string;
  arguments: Record<string, string>;
  result_id: string | null;
  succeeded: boolean;
  confirmed_at: string;
  created_at: string;
};

/** Return shape of public.monthly_spending_by_category(). */
export type MonthlySpendingRow = {
  category_name: string;
  total_minor: number;
};

/** Return shape of public.financial_summary() — the P§23 engine. */
export type FinancialSummary = {
  total_income_minor: number;
  total_expenses_minor: number;
  remaining_minor: number;
  upcoming_bills_minor: number;
  current_balance_minor: number;
  available_money_minor: number;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      accounts: Table<Account>;
      categories: Table<Category>;
      transactions: Table<Transaction>;
      bills: Table<Bill>;
      bill_payments: Table<BillPayment>;
      recurring_transactions: Table<RecurringTransaction>;
      tasks: Table<Task>;
      calendar_events: Table<CalendarEvent>;
      work_schedules: Table<WorkSchedule>;
      work_shift_exceptions: Table<WorkShiftException>;
      notification_preferences: Table<NotificationPreferencesRow>;
      budgets: Table<Budget>;
      financial_goals: Table<FinancialGoal>;
      ai_preferences: Table<AiPreferencesRow>;
      ai_conversations: Table<AiConversation>;
      ai_messages: Table<AiMessage>;
      ai_tool_grants: Table<AiToolGrant>;
      ai_action_log: Table<AiActionLogRow>;
    };
    Views: Record<string, never>;
    Functions: {
      financial_summary: {
        Args: { p_period?: string };
        Returns: FinancialSummary[];
      };
      create_transfer: {
        Args: {
          p_from_account: string;
          p_to_account: string;
          p_amount_minor: number;
          p_date?: string;
          p_description?: string | null;
        };
        Returns: string;
      };
      monthly_spending_by_category: {
        Args: { p_month?: string };
        Returns: MonthlySpendingRow[];
      };
      spending_by_classification: {
        Args: { p_month?: string };
        Returns: ClassificationSpendRow[];
      };
      saved_to_savings_minor: { Args: { p_month?: string }; Returns: number };
      /** Materialises due recurring transactions. Idempotent. Returns how many it created. */
      generate_due_recurring: { Args: { p_today?: string }; Returns: number };
      available_money_minor: { Args: { p_user: string; p_period?: string }; Returns: number };
      current_balance_minor: { Args: { p_user: string }; Returns: number };
      upcoming_bills_minor: { Args: { p_user: string; p_period?: string }; Returns: number };
    };
    Enums: {
      account_type: AccountType;
      txn_type: TxnType;
      txn_direction: TxnDirection;
      classification: Classification;
      recurrence: Recurrence;
    };
    CompositeTypes: Record<string, never>;
  };
};
