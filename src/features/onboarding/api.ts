/**
 * Recording that onboarding finished.
 *
 * One write, on the profile, server-side — see `status.ts` for why the fact is
 * stored rather than inferred.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { requireUserId, supabase } from '@/lib/supabase';

/**
 * Marks the signed-in user as onboarded.
 *
 * Idempotent by `is null`: re-running onboarding from Settings (or finishing it
 * twice on a flaky connection) must not overwrite the original date with
 * today's. The timestamp is the app's only record of when setup happened.
 *
 * `now()` is not available to PostgREST here, so the client sends the time. A
 * device clock that is wrong makes the date wrong; nothing reads this as a
 * duration, only as null-or-not, so that is a cosmetic risk rather than a
 * correctness one.
 */
export function useMarkOnboarded() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await requireUserId();

      const { error } = await supabase
        .from('profiles')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', userId)
        .is('onboarded_at', null);

      if (error) throw error;
    },
    // The dashboard's redirect reads this profile. Refetch rather than
    // invalidate at the call site — see `finish()` in the onboarding screen.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}
