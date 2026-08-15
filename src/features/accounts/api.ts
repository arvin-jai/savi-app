/**
 * Accounts data access (P§13).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Account, AccountType } from '@/lib/database.types';
import { todayISO } from '@/lib/dates';
import { qk } from '@/lib/queryClient';
import { requireUserId, supabase } from '@/lib/supabase';

/**
 * Credit cards are liabilities: the balance is money OWED, so it must not roll
 * into Current Balance or Available Money (BUILD-PLAN P1). Defaulting this from
 * the account type means a user cannot accidentally inflate their available
 * money by adding a card.
 */
export function isLiabilityType(type: AccountType): boolean {
  return type === 'credit_card';
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank account',
  ewallet: 'E-wallet',
  savings: 'Savings',
  credit_card: 'Credit card',
};

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .is('archived_at', null)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDefaultAccount() {
  const { data, ...rest } = useAccounts();
  return { ...rest, data: data?.find((a) => a.is_default) ?? data?.[0] ?? null };
}

export type CreateAccountInput = {
  name: string;
  type: AccountType;
  /** Opening balance in minor units. Written as an income transaction, not a
   *  direct balance write — see below. */
  openingBalanceMinor?: number;
  isDefault?: boolean;
};

export function useCreateAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      const userId = await requireUserId();

      // Only one default at a time — the DB has a partial unique index, so
      // clear the old one first rather than letting the insert fail.
      if (input.isDefault) {
        await supabase.from('accounts').update({ is_default: false }).eq('is_default', true);
      }

      const { data, error } = await supabase
        .from('accounts')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          type: input.type,
          is_liability: isLiabilityType(input.type),
          is_default: input.isDefault ?? false,
        })
        .select()
        .single();

      if (error) throw error;

      /**
       * An opening balance is recorded as a transaction, never as a direct
       * write to balance_minor.
       *
       * The balance column is maintained by a trigger over the ledger. Writing
       * to it directly would create a balance with no transaction behind it —
       * the account would show money that no row explains, and every future
       * reconciliation would be off by exactly that amount.
       */
      if (input.openingBalanceMinor && input.openingBalanceMinor > 0) {
        const { error: txnError } = await supabase.from('transactions').insert({
          user_id: userId,
          account_id: data.id,
          amount_minor: input.openingBalanceMinor,
          direction: 'in',
          type: 'income',
          description: 'Opening balance',
        });
        if (txnError) throw txnError;
      }

      return data as Account;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Account> & { id: string }) => {
      if (patch.is_default) {
        await supabase.from('accounts').update({ is_default: false }).eq('is_default', true);
      }
      const { data, error } = await supabase
        .from('accounts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

/**
 * Set an account's displayed value without breaking the ledger behind it.
 *
 * `balance_minor` is maintained by the transaction trigger, so writing that
 * column directly would make the balance disagree with the account history.
 * The difference is recorded as an adjustment instead: increasing the value is
 * income and decreasing it is an expense. This is the same principle used for
 * opening balances, applied later when a user reconciles an account.
 */
export function useSetAccountBalance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      currentBalanceMinor,
      targetBalanceMinor,
    }: {
      accountId: string;
      currentBalanceMinor: number;
      targetBalanceMinor: number;
    }) => {
      const delta = targetBalanceMinor - currentBalanceMinor;
      if (delta === 0) return;

      const userId = await requireUserId();
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: accountId,
        amount_minor: Math.abs(delta),
        direction: delta > 0 ? 'in' : 'out',
        type: delta > 0 ? 'income' : 'expense',
        classification: delta > 0 ? null : 'need',
        description: 'Balance adjustment',
        transaction_date: todayISO(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Archive, not delete.
 *
 * Deleting an account cascades its transactions, which silently rewrites the
 * user's financial history — last month's spending total would change. D§59
 * requires confirmation for destructive actions; this makes the action
 * non-destructive instead.
 */
/**
 * Everything that would go with the account — the facts that decide whether
 * deleting it is tidying up or destroying something.
 *
 * Two tables cascade, not one. The transaction count was here from the start;
 * the **schedules** were not, and they are the quieter loss: deleting the
 * account a salary is paid into deletes the payday itself, so income silently
 * stops arriving next month. A confirmation that names the transactions and
 * says nothing about that is worse than one that names neither, because it
 * reads as a complete account of the damage.
 */
export function useAccountDeletionImpact(accountId: string | null) {
  return useQuery({
    queryKey: ['accounts', accountId, 'deletion-impact'],
    enabled: accountId !== null,
    queryFn: async (): Promise<{ transactions: number; schedules: string[] }> => {
      if (!accountId) return { transactions: 0, schedules: [] };

      const [txns, recurring] = await Promise.all([
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId),
        supabase
          .from('recurring_transactions')
          .select('description')
          .eq('account_id', accountId)
          .is('archived_at', null),
      ]);

      if (txns.error) throw txns.error;
      if (recurring.error) throw recurring.error;

      return {
        transactions: txns.count ?? 0,
        schedules: (recurring.data ?? []).map((r) => r.description ?? 'a recurring payment'),
      };
    },
  });
}

/**
 * Permanently delete an account **and everything recorded in it**.
 *
 * ⚠️ `transactions.account_id` is `ON DELETE CASCADE`, so this removes every
 * transaction the account ever held. That is not a detail to discover
 * afterwards: it rewrites Total Income, Total Expenses and every month's
 * history, silently and irreversibly.
 *
 * The UI therefore offers this only after saying how many transactions will go
 * with it, and offers archiving as the alternative for any account that has
 * some. Archiving hides the account and keeps the ledger true, which is what
 * almost everyone actually wants — "I stopped using this account" is not the
 * same as "this money never existed".
 */
export function useDeleteAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      // Everything downstream of the ledger changed.
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: qk.bills });
      // `recurring_transactions.account_id` cascades too, so the salary
      // schedule went with the account. Reported from use: deleting Cash left
      // the Salary payday still drawn on the calendar. The rows were already
      // gone from the database — these two caches were still holding them, and
      // nothing here invalidated either. Both keys are needed: they read the
      // same table in two different shapes (see qkCalendar.recurringIncomeSchedule).
      qc.invalidateQueries({ queryKey: ['recurring-income-schedule'] });
      qc.invalidateQueries({ queryKey: ['insights', 'recurring-income'] });
    },
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .update({ archived_at: new Date().toISOString(), is_default: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: ['summary'] });
      // Archiving stops generation for any schedule paying into this account
      // (migration 20260815000600), and both recurring queries now exclude it.
      // Without these the payday stays on the calendar and in "coming in"
      // while the database has already stopped producing it.
      qc.invalidateQueries({ queryKey: ['recurring-income-schedule'] });
      qc.invalidateQueries({ queryKey: ['insights', 'recurring-income'] });
    },
  });
}
