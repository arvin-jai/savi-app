/**
 * Auth session state.
 *
 * `initialising` is deliberately distinct from "signed out". Reading a
 * persisted session off disk is async, so for the first few frames after launch
 * we genuinely do not know yet. Collapsing that into "signed out" would bounce
 * a returning user to the login screen and then snap them back — the exact
 * flicker M2's definition of done is written to prevent.
 */

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been read. Not the same as signed out. */
  initialising: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * How long to wait for a persisted session before giving up and showing the
 * signed-out UI. Long enough for a slow cold start on a real device, short
 * enough that a dead backend does not look like a frozen app.
 */
const SESSION_RESTORE_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    let active = true;

    /**
     * Never hang on the session restore.
     *
     * `getSession()` can hit the network to refresh an expired token, and if
     * the backend is unreachable that promise may never settle. Without this
     * race the app sits on a blank screen forever with no message and no way
     * out — which is exactly what happened on an emulator that could not reach
     * the local Supabase, and would happen to any user whose connection drops
     * at launch.
     *
     * On timeout we proceed as signed-out: the user lands on Welcome, and any
     * sign-in attempt surfaces a real network error through authErrorMessage
     * rather than an indefinite spinner.
     *
     * The window is deliberately generous. On a merely SLOW connection this
     * would show Welcome and then snap to the dashboard once the session
     * arrived — the flicker the header of this file exists to prevent — so the
     * threshold has to sit well beyond any plausible success. The
     * `onAuthStateChange` listener below is what recovers that late session;
     * without it a slow restore would silently sign the user out.
     */
    const timer = setTimeout(() => {
      if (!active) return;
      setSession(null);
      setInitialising(false);
    }, SESSION_RESTORE_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        clearTimeout(timer);
        setSession(data.session);
        setInitialising(false);
      })
      .catch(() => {
        if (!active) return;
        clearTimeout(timer);
        setSession(null);
        setInitialising(false);
      });

    // Covers sign-in, sign-out, and silent token refresh. Without this a
    // refreshed token never reaches React state and the app keeps a stale one.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setInitialising(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initialising,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, initialising]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
