/**
 * Parsing the password-recovery deep link.
 *
 * Supabase mails a link to `/auth/v1/verify`, which redirects to whatever
 * `redirectTo` we asked for and hands the result over in the URL. On web the
 * client consumes that itself (`detectSessionInUrl`), but native has no URL bar
 * to read a session out of — see `lib/supabase.ts` — so the app receives the
 * raw deep link and has to unpack it by hand.
 *
 * Pure and I/O-free on purpose: the awkward part is the URL shapes, not the
 * network, and this way they are testable without a device or a mailbox.
 *
 * Three shapes arrive in practice:
 *
 *   implicit flow  savi://reset-password#access_token=…&refresh_token=…&type=recovery
 *   PKCE flow      savi://reset-password?code=…
 *   failure        savi://reset-password#error=access_denied&error_code=otp_expired&…
 *
 * supabase-js v2 defaults to the implicit flow, so the fragment form is what
 * this project actually sees today. The `code` form is handled anyway because
 * flipping `flowType` is a one-line change someone will eventually make, and a
 * silent "invalid link" screen is a miserable way to discover that.
 */

export type RecoveryLink =
  /** Implicit flow: tokens arrived and can be exchanged for a session. */
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  /** PKCE flow: an authorisation code to exchange. */
  | { kind: 'code'; code: string }
  /** The link itself carried a failure — expired, already used, tampered with. */
  | { kind: 'error'; message: string }
  /** Nothing recovery-shaped here. */
  | { kind: 'none' };

/**
 * Both halves of the URL, merged.
 *
 * Which half carries the payload depends on the flow, and reading only one is
 * how this breaks silently the day someone changes `flowType`. The query string
 * wins on collision, arbitrarily — no real link populates both.
 */
function paramsFrom(url: string): URLSearchParams {
  const merged = new URLSearchParams();

  const hashAt = url.indexOf('#');
  if (hashAt !== -1) {
    for (const [k, v] of new URLSearchParams(url.slice(hashAt + 1))) merged.set(k, v);
  }

  const queryAt = url.indexOf('?');
  // A '?' after the '#' belongs to the fragment, not to the query string.
  if (queryAt !== -1 && (hashAt === -1 || queryAt < hashAt)) {
    const end = hashAt === -1 ? url.length : hashAt;
    for (const [k, v] of new URLSearchParams(url.slice(queryAt + 1, end))) merged.set(k, v);
  }

  return merged;
}

/**
 * Plain language for the failures a user can actually hit (D§58, P§63).
 *
 * Supabase's `error_description` is URL-encoded prose written for a developer.
 * Expired is by far the most common — the default recovery window is an hour —
 * and it has an obvious next step, so it gets its own message.
 */
function errorMessage(code: string | null, description: string | null): string {
  if (code === 'otp_expired') {
    return 'That reset link has expired. Send yourself a new one.';
  }
  if (code === 'access_denied') {
    return 'That reset link is no longer valid. It may already have been used.';
  }
  if (description) {
    // Already decoded by URLSearchParams; just make it a sentence.
    const trimmed = description.trim();
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  }
  return 'That reset link did not work. Send yourself a new one.';
}

export function parseRecoveryLink(url: string | null | undefined): RecoveryLink {
  if (!url) return { kind: 'none' };

  const params = paramsFrom(url);

  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    return {
      kind: 'error',
      message: errorMessage(params.get('error_code') ?? params.get('error'), params.get('error_description')),
    };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'tokens', accessToken, refreshToken };
  }

  const code = params.get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'none' };
}
