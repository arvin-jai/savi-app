/**
 * Transactions data access (corrected P§14).
 *
 * Amounts crossing this boundary are always POSITIVE minor units. Direction
 * comes from `direction`, never from the sign of the number.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Category, Classification, Transaction, TxnType } from '@/lib/database.types';
import { todayISO } from '@/lib/dates';
import { qk } from '@/lib/queryClient';
import { requireUserId, supabase } from '@/lib/supabase';

import {
  startOfWeek,
  summariseSpend,
  type SpendRow,
  type SpendSummary,
} from './spend';
import { buildBalanceTrend, type TrendPoint } from './trend';

export type TransactionWithCategory = Transaction & {
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
  account: { id: string; name: string } | null;
};

/**
 * The ledger, newest first.
 *
 * `accountId` scopes it to one account for the account detail screen. It is
 * part of the query KEY as well as the filter — sharing a key between the full
 * list and a filtered one would serve whichever resolved first to both, and on
 * a money screen that means showing a user someone else's arithmetic about
 * their own balance.
 *
 * The key stays under the `['transactions']` prefix, so `invalidateMoney()`
 * still reaches every variant without having to know they exist.
 */
export function useTransactions(limit = 100, accountId?: string) {
  return useQuery({
    queryKey: accountId ? qk.transactions({ limit, accountId }) : qk.transactions({ limit }),
    queryFn: async (): Promise<TransactionWithCategory[]> => {
      let query = supabase
        .from('transactions')
        .select('*, category:categories(id,name,slug), account:accounts(id,name)')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (accountId) query = query.eq('account_id', accountId);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as unknown as TransactionWithCategory[];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    // System categories are seeded and effectively immutable.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type CreateTransactionInput = {
  accountId: string;
  amountMinor: number;
  type: Extract<TxnType, 'income' | 'expense'>;
  classification?: Classification | null;
  categoryId?: string | null;
  description?: string | null;
  date?: string;
};

function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  // A movement changes the ledger, the balances, and every derived figure.
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: qk.accounts });
  qc.invalidateQueries({ queryKey: ['summary'] });
}

export function useCreateTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const userId = await requireUserId();

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          account_id: input.accountId,
          amount_minor: input.amountMinor,
          direction: input.type === 'income' ? 'in' : 'out',
          type: input.type,
          // The DB enforces classification iff expense; mirror it here so a bad
          // call fails with a clear message instead of a constraint violation.
          classification: input.type === 'expense' ? (input.classification ?? 'need') : null,
          category_id: input.categoryId ?? null,
          description: input.description?.trim() || null,
          // todayISO(), not toISOString() — the latter is UTC, so a purchase
          // made at 7am in Manila (UTC+8) would be filed to the previous day.
          // The column default is also UTC `current_date`, so the client must
          // always send this explicitly.
          transaction_date: input.date ?? todayISO(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => invalidateMoney(qc),
  });
}

/**
 * Transfers go through the RPC, never through two client-side inserts.
 *
 * Writing both legs from here would mean two round trips with a window where
 * half a transfer exists — and if the second one failed, money would have
 * vanished from one account without arriving anywhere. One statement, one
 * transaction (BUILD-PLAN P3).
 */
export function useCreateTransfer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      fromAccountId: string;
      toAccountId: string;
      amountMinor: number;
      description?: string | null;
      date?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_transfer', {
        p_from_account: input.fromAccountId,
        p_to_account: input.toAccountId,
        p_amount_minor: input.amountMinor,
        p_date: input.date ?? todayISO(),
        p_description: input.description ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (txn: Pick<Transaction, 'id' | 'transfer_group_id'>) => {
      // Deleting one leg of a transfer would leave money created or destroyed,
      // and the deferred pair constraint would reject the commit anyway. Always
      // delete the whole group (corrected P§14).
      if (txn.transfer_group_id) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('transfer_group_id', txn.transfer_group_id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('transactions').delete().eq('id', txn.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMoney(qc),
  });
}

/**
 * The last N days of daily closing balance, for the dashboard sparkline.
 *
 * Derived rather than stored: today's balance walked backwards through the
 * ledger by `buildBalanceTrend`. Nothing new is persisted, so the line can
 * never disagree with the transactions it is drawn from.
 *
 * Transfers are deliberately included — they move money between the user's own
 * accounts and net to zero across all of them, which is exactly right for a
 * total-balance line. Liability accounts are excluded, matching
 * `current_balance_minor()`.
 */
export function useBalanceTrend(days = 14) {
  const { data: summary } = useFinancialSummary();
  const currentBalance = summary?.current_balance_minor ?? 0;

  return useQuery({
    queryKey: ['balance-trend', days, currentBalance, todayISO()],
    enabled: summary !== undefined,
    queryFn: async (): Promise<TrendPoint[]> => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const p = (n: number) => String(n).padStart(2, '0');
      const sinceISO = `${since.getFullYear()}-${p(since.getMonth() + 1)}-${p(since.getDate())}`;

      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_date, amount_minor, direction, account:accounts!inner(is_liability)')
        .gte('transaction_date', sinceISO);
      if (error) throw error;

      const netByDate = new Map<string, number>();
      for (const row of data ?? []) {
        const account = row.account as unknown as { is_liability: boolean } | null;
        // A credit card is money owed; `current_balance_minor()` leaves it out,
        // so the line drawn back from that figure must leave it out too.
        if (account?.is_liability) continue;

        const signed = row.direction === 'in' ? row.amount_minor : -row.amount_minor;
        netByDate.set(row.transaction_date, (netByDate.get(row.transaction_date) ?? 0) + signed);
      }

      return buildBalanceTrend(
        currentBalance,
        [...netByDate.entries()].map(([date, netMinor]) => ({ date, netMinor })),
        days
      );
    },
  });
}

/**
 * Spending so far today and this calendar week, for the dashboard caption.
 *
 * Fetches from the week start rather than a fixed number of days, so the window
 * matches `summariseSpend`'s definition of "this week" exactly — a 7-day fetch
 * feeding a Monday-based sum would silently drop rows on a Sunday. The
 * arithmetic lives in `spend.ts`; this only goes and gets the rows.
 */
export function useWeekSpend() {
  const today = todayISO();
  const weekStart = startOfWeek(today);

  return useQuery({
    queryKey: ['spend', 'week', weekStart, today],
    queryFn: async (): Promise<SpendSummary> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_date, amount_minor, direction, type')
        .eq('direction', 'out')
        // Transfers are excluded again in `summariseSpend`. Belt and braces on
        // purpose: this one saves the bytes, that one is the invariant, and the
        // invariant is the half with a test behind it.
        .neq('type', 'transfer')
        .gte('transaction_date', weekStart)
        .lte('transaction_date', today);

      if (error) throw error;
      return summariseSpend((data ?? []) as SpendRow[], today);
    },
  });
}

/** The P§23 engine. Calculated server-side; the client only displays it. */
export function useFinancialSummary(period?: string) {
  return useQuery({
    queryKey: qk.summary(period),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('financial_summary', period ? { p_period: period } : {})
        .single();
      if (error) throw error;
      return data;
    },
  });
}
