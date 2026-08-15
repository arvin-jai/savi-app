/**
 * Supabase client.
 *
 * Session persistence is the reason this file has any complexity: M2's
 * definition of done is "sign up, kill the app, reopen, still signed in", and
 * that requires a storage adapter that survives process death. AsyncStorage on
 * native; localStorage on web (Supabase's default there).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.\n' +
      'Copy .env.example to .env and fill it in — see docs/BUILD-PLAN.md M2.'
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Web has localStorage and Supabase uses it by default; passing AsyncStorage
    // there would break SSR/static export.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Native has no URL bar to read a session out of.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/**
 * The signed-in user's id, for writes that need `user_id`.
 *
 * Uses `getSession()`, NOT `getUser()`, and the difference is the whole point:
 *
 *   getUser()    → asks the server who this token belongs to. On a dead
 *                  network it rejects, and a caller that reads "no user" as
 *                  "signed out" will tell a signed-in person they are logged
 *                  out because their train went into a tunnel.
 *   getSession() → reads the persisted session locally. No network unless the
 *                  token actually needs refreshing.
 *
 * Found by cutting the network and pressing "Mark as paid": every mutation
 * reported **"Not signed in"**. In a finance app that is an alarming lie — the
 * same class of failure as M9's black screen, where an unreachable backend was
 * reported as a broken app.
 *
 * Throws a distinguishable error so callers can tell "you are logged out" from
 * "we could not reach the server", and `authErrorMessage` renders both in plain
 * language.
 */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw new Error('offline: could not read your session');
  const userId = data.session?.user?.id;
  if (!userId) throw new Error('Not signed in');

  return userId;
}

/**
 * Auth errors reach users, so they get plain language (D§58, P§63).
 * Supabase's raw messages are accurate but read like a stack trace.
 */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return "That email and password don't match. Try again?";
  }
  if (m.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email first.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'There is already an account with this email. Try signing in.';
  }
  if (m.includes('password should be at least')) {
    return 'Use a password with at least 6 characters.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('offline')) {
    return "Savi couldn't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
