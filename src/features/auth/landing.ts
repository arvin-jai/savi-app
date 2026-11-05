/**
 * Where a signed-out user lands.
 *
 * Welcome is a first-run screen, so it is shown on the first launch of an
 * install and never again. It states what Savi is for, which is worth a screen
 * exactly once; showing it on every sign-out makes someone who already knows
 * the pitch tap through a marketing page to reach a password field.
 *
 * After that the answer is Login, which is what a returning user wants and
 * which already carries "Create an account" for the case where they don't. No
 * entry point is lost by this — Welcome's two buttons are Login and Signup, and
 * both screens link to the other.
 *
 * **First launch, not first sign-in.** The flag is set the first time the app
 * opens, whether or not anyone gets as far as an account. Someone who opens
 * Savi, reads Welcome, closes it and comes back tomorrow has already had the
 * introduction. It resets on reinstall, because the flag lives in app storage —
 * a genuinely new install is a genuinely new user as far as this screen knows.
 */

/** The two screens a signed-out user can be sent to. */
export type LandingRoute = '/(auth)/welcome' | '/(auth)/login';

/**
 * `hasLaunchedBefore` is null while the flag is still being read off disk.
 * Returning null for that says "do not navigate yet" — guessing would show
 * Welcome for a few frames and then replace it, which is the flicker
 * `AuthProvider`'s `initialising` state exists to avoid.
 */
export function landingRoute(hasLaunchedBefore: boolean | null): LandingRoute | null {
  if (hasLaunchedBefore === null) return null;
  return hasLaunchedBefore ? '/(auth)/login' : '/(auth)/welcome';
}
