/**
 * Route guard.
 *
 * Three states, not two:
 *   initialising → hold the splash. We are still reading the persisted session.
 *   signed out   → redirect into (auth)
 *   signed in    → redirect out of (auth)
 *
 * Treating `initialising` as "signed out" would bounce a returning user to the
 * login screen for a few frames and then snap them back to the dashboard. That
 * flicker is exactly what M2's definition of done — "kill the app, reopen,
 * still signed in" — is written to catch.
 */

import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AmbientBackground } from '@/components/AmbientBackground';
import { HOME } from '@/lib/routes';
import { useTheme } from '@/theme/ThemeProvider';

import { useAuth } from './AuthProvider';
import { landingRoute } from './landing';
import { useHasLaunchedBefore } from './launchStore';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, initialising } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const theme = useTheme();

  // Welcome on a fresh install, Login afterwards. Null while the flag is being
  // read — see landing.ts.
  const landing = landingRoute(useHasLaunchedBefore());

  useEffect(() => {
    // Navigating before the router has mounted throws.
    if (!navigationState?.key) return;
    if (initialising) return;

    const inAuthGroup = segments[0] === '(auth)';
    // Dev routes stay reachable signed-out so the kitchen sink and the M0 spike
    // don't require an account to open.
    const inDevGroup = segments[0] === 'dev';

    /**
     * Password recovery is the one place a session is not a reason to leave.
     *
     * The emailed link exchanges a recovery token for a real session *before*
     * the user has set anything, so the rule below would fire immediately and
     * bounce them to the dashboard mid-reset — with their old password still
     * in force and no indication of what went wrong.
     */
    const inPasswordReset = inAuthGroup && segments[1] === 'reset-password';

    if (!session && !inAuthGroup && !inDevGroup) {
      // Nothing to do until the first-launch flag lands; this effect re-runs
      // when it does. Defaulting to Welcome here would show it for a frame to
      // every returning user, which is the whole thing we are removing.
      if (landing) router.replace(landing);
    } else if (session && inAuthGroup && !inPasswordReset) {
      router.replace(HOME);
    }
  }, [session, initialising, segments, navigationState?.key, landing]);

  if (initialising) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AmbientBackground />
        <ActivityIndicator color={theme.color.brand} />
      </View>
    );
  }

  return <>{children}</>;
}
