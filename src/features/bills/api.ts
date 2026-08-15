/**
 * Bills data access.
 *
 * "Mark as paid" is an EVENT (a bill_payments row), not a flag on the bill.
 * That is what makes undo, payment history, and "how much of my bills have I
 * actually paid this month" answerable — and it is why D§59 can safely drop
 * the confirmation dialog: the action is a row that can be deleted.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Bill, BillPayment } from '@/lib/database.types';
import { currentPeriod, todayISO } from '@/lib/dates';
import { qk } from '@/lib/queryClient';
import { requireUserId, supabase } from '@/lib/supabase';

import { billStatus, currentPeriodFor, nextDueDate, type BillStatus } from './schedule';

export type BillWithStatus = Bill & {
  /** Next date this bill falls due, or null if it has no schedule. */
  dueDate: string | null;
  status: BillStatus;
  /** The payment settling the current period, if there is one. */
  payment: BillPayment | null;
};

const STATUS_ORDER: Record<BillStatus, number> = {
  overdue: 0,
  'due-soon': 1,
  upcoming: 2,
  paid: 3,
};

export function useBills() {
  return useQuery({
    queryKey: qk.bills,
    queryFn: async (): Promise<BillWithStatus[]> => {
      const period = currentPeriodFor();

      const [billsRes, paymentsRes] = await Promise.all([
        supabase.from('bills').select('*').is('archived_at', null).order('due_day'),
        supabase.from('bill_payments').select('*').eq('period', period),
      ]);

      if (billsRes.error) throw billsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const payments = new Map((paymentsRes.data ?? []).map((p) => [p.bill_id, p]));

      const bills = (billsRes.data ?? []).map((bill): BillWithStatus => {
        const payment = payments.get(bill.id) ?? null;
        const paidPeriods = payment ? new Set([period]) : new Set<string>();
        const dueDate = nextDueDate(bill, paidPeriods);

        return { ...bill, dueDate, status: billStatus(dueDate, !!payment), payment };
      });

      // Most urgent first. A list sorted by due_day would bury an overdue bill
      // below one that isn't due for three weeks.
      return bills.sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
      );
    },
  });
}

function invalidateBills(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.bills });
  // Upcoming Bills feeds Available Money, so the summary is stale too.
  qc.invalidateQueries({ queryKey: ['summary'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: qk.accounts });
}

export function useCreateBill() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      amountMinor: number;
      dueDay: number;
      /** 1 = monthly, 3 = quarterly, 6 = half-yearly, 12 = yearly. */
      intervalMonths?: number;
      categoryId?: string | null;
      accountId?: string | null;
    }) => {
      const userId = await requireUserId();
      const intervalMonths = input.intervalMonths ?? 1;

      // A non-monthly bill needs an anchor saying WHICH months it lands in.
      // The current month is the natural first occurrence: the user is adding
      // it now because it is due now or soon. Monthly bills store null — every
      // month is an occurrence, so an anchor would carry no information and
      // could only drift.
      const anchorMonth = intervalMonths === 1 ? null : currentPeriod();

      const { data, error } = await supabase
        .from('bills')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          amount_minor: input.amountMinor,
          recurrence: 'monthly',
          due_day: input.dueDay,
          interval_months: intervalMonths,
          anchor_month: anchorMonth,
          category_id: input.categoryId ?? null,
          account_id: input.accountId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Bill;
    },
    onSuccess: () => invalidateBills(qc),
  });
}

/**
 * Mark paid.
 *
 * Writes the payment event and, when an account is known, the money movement
 * that goes with it — classification 'bill', linked back to the payment row.
 *
 * If the transaction write fails, the payment row is rolled back by hand. The
 * two are not in one database transaction (PostgREST gives us one statement per
 * call), and a payment with no transaction would show the bill as settled while
 * the money never left the account.
 */
export function useMarkBillPaid() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (bill: BillWithStatus) => {
      const userId = await requireUserId();

      const period = currentPeriodFor();

      const { data: payment, error } = await supabase
        .from('bill_payments')
        .insert({ user_id: userId, bill_id: bill.id, period })
        .select()
        .single();

      if (error) throw error;

      if (!bill.account_id) return payment as BillPayment;

      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          account_id: bill.account_id,
          amount_minor: bill.amount_minor,
          direction: 'out',
          type: 'expense',
          classification: 'bill',
          category_id: bill.category_id,
          description: bill.name,
          transaction_date: todayISO(),
        })
        .select()
        .single();

      if (txnError) {
        await supabase.from('bill_payments').delete().eq('id', payment.id);
        throw txnError;
      }

      const { data: linked, error: linkError } = await supabase
        .from('bill_payments')
        .update({ transaction_id: txn.id })
        .eq('id', payment.id)
        .select()
        .single();

      if (linkError) {
        // Never leave a transaction with no payment pointing at it.
        await supabase.from('transactions').delete().eq('id', txn.id);
        await supabase.from('bill_payments').delete().eq('id', payment.id);
        throw linkError;
      }

      /**
       * Return the LINKED row, not the one from the first insert.
       *
       * `payment` above still has transaction_id: null. Returning it handed the
       * undo closure a payment that looked unlinked, so Undo deleted the
       * payment row and left the transaction orphaned — the money gone from the
       * account with nothing marking it as a bill payment.
       */
      return linked as BillPayment;
    },
    onSuccess: () => invalidateBills(qc),
  });
}

/**
 * Undo a payment — the affordance that makes the missing confirmation safe.
 *
 * Removes the linked transaction as well. Deleting only the payment row would
 * leave the money gone from the account with nothing marking it as a bill
 * payment, which is worse than either outcome on its own.
 */
export function useUndoBillPayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payment: BillPayment) => {
      if (payment.transaction_id) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', payment.transaction_id);
        if (error) throw error;
      }

      const { error } = await supabase.from('bill_payments').delete().eq('id', payment.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBills(qc),
  });
}

/**
 * Permanently delete a bill.
 *
 * Less destructive than deleting an account, and worth knowing why: this
 * cascades to `bill_payments` — the record of which months were settled — but
 * **not** to the transactions those payments created. `bill_payments.transaction_id`
 * is `ON DELETE SET NULL` in the other direction, so the money already paid
 * stays in the ledger where it belongs. Deleting a bill forgets the schedule,
 * not the spending.
 *
 * Still confirmed in the UI: D§59 names "Delete bill" as a destructive action,
 * and losing payment history is not something to discover afterwards.
 */
export function useDeleteBill() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bills').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBills(qc),
  });
}

export function useArchiveBill() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bills')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBills(qc),
  });
}
