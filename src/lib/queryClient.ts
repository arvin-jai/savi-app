/**
 * Server-state configuration.
 *
 * Savi is a phone app for money, so the defaults here assume the network is
 * unreliable rather than treating that as the exception. D§58 and the review's
 * offline gap both point the same way: showing stale data with a banner beats
 * showing a spinner or a blank screen.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Money doesn't change behind your back very often, and every refetch on
      // a phone costs battery and data.
      staleTime: 30_000,
      // Keep serving the last good data while refetching, so a reconnect never
      // blanks a list the user is reading.
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      // The offline banner is driven off this: a failed query keeps its data.
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations are NOT retried by default. A retried "add transaction" that
      // actually succeeded the first time creates a duplicate — and a duplicate
      // in a ledger is worse than a visible failure the user can repeat.
      retry: 0,
    },
  },
});

/** Query keys in one place so invalidation can't drift from fetching. */
export const qk = {
  accounts: ['accounts'] as const,
  account: (id: string) => ['accounts', id] as const,
  transactions: (filters?: Record<string, unknown>) =>
    filters ? (['transactions', filters] as const) : (['transactions'] as const),
  categories: ['categories'] as const,
  summary: (period?: string) => ['summary', period ?? 'current'] as const,
  bills: ['bills'] as const,
};
