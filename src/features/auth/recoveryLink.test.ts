import { parseRecoveryLink } from './recoveryLink';

describe('parseRecoveryLink', () => {
  it('reads implicit-flow tokens out of the fragment', () => {
    // The shape supabase-js v2 actually produces today.
    const link =
      'savi://reset-password#access_token=abc.def.ghi&expires_in=3600' +
      '&refresh_token=r3fr3sh&token_type=bearer&type=recovery';

    expect(parseRecoveryLink(link)).toEqual({
      kind: 'tokens',
      accessToken: 'abc.def.ghi',
      refreshToken: 'r3fr3sh',
    });
  });

  it('reads a PKCE code out of the query string', () => {
    expect(parseRecoveryLink('savi://reset-password?code=9f8e7d6c')).toEqual({
      kind: 'code',
      code: '9f8e7d6c',
    });
  });

  it('needs BOTH tokens before it claims a session', () => {
    // Half a pair cannot be exchanged, and calling setSession with an empty
    // refresh token fails in a way that reads as "invalid link" to the user.
    expect(parseRecoveryLink('savi://reset-password#access_token=abc&type=recovery')).toEqual({
      kind: 'none',
    });
  });

  it('names the expired link, because that one has an obvious next step', () => {
    const link =
      'savi://reset-password#error=access_denied&error_code=otp_expired' +
      '&error_description=Email+link+is+invalid+or+has+expired';

    const result = parseRecoveryLink(link);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toBe('That reset link has expired. Send yourself a new one.');
    }
  });

  it('falls back to the server description when the code is unfamiliar', () => {
    const result = parseRecoveryLink(
      'savi://reset-password#error_code=server_error&error_description=Something+specific+went+wrong'
    );
    expect(result).toEqual({ kind: 'error', message: 'Something specific went wrong.' });
  });

  it('prefers the error over tokens that came with it', () => {
    // Defensive: never hand a half-failed link to setSession.
    const result = parseRecoveryLink(
      'savi://reset-password#error_code=otp_expired&access_token=abc&refresh_token=def'
    );
    expect(result.kind).toBe('error');
  });

  it('does not mistake a fragment "?" for a query string', () => {
    // The web build's URL can carry both; reading the fragment's '?' as the
    // start of the query is how a valid link parses as garbage.
    const link = 'http://localhost:8081/reset-password#access_token=abc&refresh_token=def?x=1';
    const result = parseRecoveryLink(link);
    expect(result.kind).toBe('tokens');
  });

  it('reports plain URLs and nothing at all as "none", not as an error', () => {
    // Web consumes the fragment itself (detectSessionInUrl), so by the time the
    // screen looks there is nothing left — that is success, not failure.
    expect(parseRecoveryLink('http://localhost:8081/reset-password')).toEqual({ kind: 'none' });
    expect(parseRecoveryLink(null)).toEqual({ kind: 'none' });
    expect(parseRecoveryLink(undefined)).toEqual({ kind: 'none' });
    expect(parseRecoveryLink('')).toEqual({ kind: 'none' });
  });
});
