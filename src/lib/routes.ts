/**
 * Route constants.
 *
 * `HOME` exists because Expo Router's typed-route generator does not emit a
 * bare `/` alias for an index that lives inside a group — `(tabs)/index.tsx`
 * yields `/(tabs)` in the object union and nothing at all in the string union,
 * so neither `router.replace('/')` nor `router.replace('/(tabs)')` typechecks.
 *
 * The generator's output is independently suspect in this project: it also
 * lists non-routes such as `/../lib/supabase` and a path inside
 * `supabase/.temp/` among the valid hrefs.
 *
 * The value is `/(tabs)`, NOT `/`. There is no root index route — the app's
 * only index lives inside the group — so `router.replace('/')` silently
 * no-ops: it navigates nowhere and leaves the current screen mounted. That
 * failure is invisible (no throw, no console warning), which is exactly why
 * it is written down here.
 *
 * The cast is confined to this file rather than disabling `typedRoutes`
 * globally, which would drop real checking from every other href in the app.
 */

import type { Href } from 'expo-router';

/** The dashboard, i.e. `(tabs)/index.tsx`. */
export const HOME: Href = '/(tabs)' as Href;

/**
 * One account's own ledger, i.e. `account/[id].tsx`.
 *
 * A helper rather than a bare string at each call site: the object form is the
 * one that survives the typed-route generator, and keeping the single cast here
 * means the same problem this file already documents does not get solved four
 * different ways across the screens that link to an account.
 */
export function accountRoute(id: string): Href {
  return { pathname: '/account/[id]', params: { id } } as Href;
}
