/**
 * Account labels for pickers.
 *
 * Nothing stops a user having two accounts called "Cash" — and people do, quite
 * reasonably: a wallet and a jar, two envelopes, one per person. What is not
 * reasonable is a "Pay from" row showing two identical chips and no way to tell
 * which is which. Reported from real use, with two accounts named Cash holding
 * ₱30,000 and ₱1,000.
 *
 * The rule: show the name alone when it is unique, and add a disambiguator
 * ONLY when it isn't. Appending the balance to every chip would be clutter in
 * the common case; appending nothing when it matters is a broken picker.
 *
 * The balance is the right disambiguator rather than the account type: two
 * accounts named "Cash" are usually both `cash`, so the type distinguishes
 * nothing — and "which one has the money in it" is the actual question someone
 * is answering when they pick an account to pay a bill from.
 *
 * Pure, no I/O, so it is testable without rendering a picker.
 */

import type { Account } from '@/lib/database.types';
import { formatMoney, type CurrencyCode } from '@/lib/money';

type LabelledAccount = Pick<Account, 'id' | 'name' | 'balance_minor'> & {
  currency?: string;
};

function normalise(name: string): string {
  // "Cash" and "cash " collide for a human reading a row of chips, so they
  // collide here too.
  return name.trim().toLowerCase();
}

/**
 * A label that is unique within `all`.
 *
 * @param account the one being labelled
 * @param all every account shown in the same picker
 */
export function accountLabel(account: LabelledAccount, all: LabelledAccount[]): string {
  const name = account.name.trim();

  const duplicates = all.filter((a) => normalise(a.name) === normalise(account.name));
  if (duplicates.length <= 1) return name;

  const balance = formatMoney(account.balance_minor, {
    currency: (account.currency as CurrencyCode) ?? undefined,
    compact: true,
    signDisplay: 'never',
  });

  return `${name} · ${balance}`;
}
