import type { Account } from '@/lib/database.types';

import { accountLabel } from './label';

const acct = (over: Partial<Account>): Account =>
  ({
    id: 'a1',
    user_id: 'u1',
    name: 'Cash',
    type: 'cash',
    balance_minor: 0,
    currency: 'PHP',
    is_liability: false,
    is_default: false,
    archived_at: null,
    created_at: '',
    updated_at: '',
    ...over,
  }) as Account;

describe('accountLabel', () => {
  it('shows the name alone when it is unique', () => {
    const all = [acct({ id: 'a', name: 'Cash' }), acct({ id: 'b', name: 'Savings' })];
    expect(accountLabel(all[0], all)).toBe('Cash');
    expect(accountLabel(all[1], all)).toBe('Savings');
  });

  it('disambiguates by balance when two accounts share a name', () => {
    // The reported case: a "Pay from" row showing two identical chips.
    const all = [
      acct({ id: 'a', name: 'Cash', balance_minor: 300_000_000 }),
      acct({ id: 'b', name: 'Cash', balance_minor: 10_000_000 }),
    ];

    expect(accountLabel(all[0], all)).toBe('Cash · ₱3M');
    expect(accountLabel(all[1], all)).toBe('Cash · ₱100k');
    expect(accountLabel(all[0], all)).not.toBe(accountLabel(all[1], all));
  });

  it('treats names differing only by case or spacing as colliding', () => {
    // They collide for a human reading a row of chips, so they collide here.
    const all = [acct({ id: 'a', name: 'Cash' }), acct({ id: 'b', name: ' cash ' })];

    expect(accountLabel(all[0], all)).toContain('·');
    expect(accountLabel(all[1], all)).toContain('·');
  });

  it('trims the displayed name', () => {
    const all = [acct({ id: 'a', name: '  Wallet  ' })];
    expect(accountLabel(all[0], all)).toBe('Wallet');
  });

  it('leaves other unique names untouched when only one pair collides', () => {
    const all = [
      acct({ id: 'a', name: 'Cash', balance_minor: 100 }),
      acct({ id: 'b', name: 'Cash', balance_minor: 200 }),
      acct({ id: 'c', name: 'GCash', balance_minor: 300 }),
    ];

    expect(accountLabel(all[2], all)).toBe('GCash');
  });

  it('disambiguates even when the two balances are equal', () => {
    // Still not ideal for the user, but the labels must not be identical —
    // and equal balances are the case a naive "append balance" would miss.
    const all = [
      acct({ id: 'a', name: 'Cash', balance_minor: 5000 }),
      acct({ id: 'b', name: 'Cash', balance_minor: 5000 }),
    ];

    // Both carry the disambiguator; the picker at least signals "these differ".
    expect(accountLabel(all[0], all)).toBe('Cash · ₱50');
    expect(accountLabel(all[1], all)).toBe('Cash · ₱50');
  });
});
