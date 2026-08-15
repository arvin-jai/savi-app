/**
 * Set a new password, arrived at from the emailed recovery link.
 *
 * The link signs the user in — a recovery token *is* a session — so by the time
 * this screen can accept a new password, `session` is non-null. That is why
 * `AuthGate` exempts this route from its "signed in ⇒ leave (auth)" rule:
 * without the exemption the guard fires the instant the token is exchanged and
 * throws the user onto the dashboard mid-reset, never having set anything.
 *
 * Platform split, inherited from `lib/supabase.ts`:
 *   web     `detectSessionInUrl` is on, so the client consumes the fragment
 *           itself and the session is simply there. Nothing to parse.
 *   native  no URL bar, so the deep link arrives raw and we unpack it — see
 *           `recoveryLink.ts` for the shapes.
 *
 * Finishes by signing out. The alternative is to drop the user straight onto
 * the dashboard still holding the recovery session, which works but leaves them
 * unsure whether the new password actually took. Making them use it once
 * answers that.
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { useAuth } from '@/features/auth/AuthProvider';
import { MIN_PASSWORD } from '@/features/auth/password';
import { parseRecoveryLink } from '@/features/auth/recoveryLink';
import { authErrorMessage, supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

type Stage =
  /** Still working out whether we hold a valid recovery session. */
  | { name: 'checking' }
  /** Good link: the form is usable. */
  | { name: 'ready' }
  /** Bad or expired link, with something the user can act on. */
  | { name: 'invalid'; message: string }
  /** Password changed and the recovery session torn down. */
  | { name: 'done' };

export default function ResetPassword() {
  const { session } = useAuth();
  const [stage, setStage] = useState<Stage>({ name: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Exchanging a token is not idempotent, and both the initial URL and the
   * listener can deliver the same link on a cold start.
   */
  const consumed = useRef(false);

  const consume = useCallback(async (url: string | null) => {
    const link = parseRecoveryLink(url);
    if (link.kind === 'none') return;
    if (consumed.current) return;
    consumed.current = true;

    if (link.kind === 'error') {
      setStage({ name: 'invalid', message: link.message });
      return;
    }

    const { error: err } =
      link.kind === 'tokens'
        ? await supabase.auth.setSession({
            access_token: link.accessToken,
            refresh_token: link.refreshToken,
          })
        : await supabase.auth.exchangeCodeForSession(link.code);

    if (err) {
      // Re-arm: a network blip should not permanently burn a link that may
      // still be valid.
      consumed.current = false;
      setStage({ name: 'invalid', message: authErrorMessage(err.message) });
      return;
    }
    setStage({ name: 'ready' });
  }, []);

  useEffect(() => {
    let active = true;

    // Cold start: the link is what launched the app.
    Linking.getInitialURL().then((url) => {
      if (active) void consume(url);
    });

    // Warm start: the app was already running when the link was tapped.
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (active) void consume(url);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [consume]);

  /**
   * The web path, and the tail of the native one.
   *
   * On web the client has already swallowed the fragment, so there is no link
   * left to parse and the only evidence the recovery worked is the session
   * itself. Holding a session while still "checking" therefore *is* the ready
   * state — derived during render rather than synced in an effect, which is
   * what `react-hooks/set-state-in-effect` is there to catch.
   */
  const view: Stage = stage.name === 'checking' && session ? { name: 'ready' } : stage;

  /**
   * No session and no link means someone opened this route directly. Say so
   * rather than showing a form that cannot possibly work — but give the deep
   * link a moment to arrive first, since `getInitialURL` is async.
   */
  useEffect(() => {
    if (view.name !== 'checking') return;
    const timer = setTimeout(() => {
      setStage((s) =>
        s.name === 'checking'
          ? { name: 'invalid', message: 'Open the link from your reset email to set a new password.' }
          : s
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [view.name]);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= MIN_PASSWORD && confirm === password && !saving;

  async function save() {
    setError(null);
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setSaving(false);
      setError(authErrorMessage(err.message));
      return;
    }

    // Drop the recovery session so the new password is what gets them back in.
    await supabase.auth.signOut();
    setSaving(false);
    setStage({ name: 'done' });
  }

  if (view.name === 'checking') {
    return (
      <AuthScreen title="Checking your link" subtitle="One moment.">
        <Text variant="bodySm" tone="secondary">
          Verifying the reset link you opened.
        </Text>
      </AuthScreen>
    );
  }

  if (view.name === 'invalid') {
    return (
      <AuthScreen
        title="That link didn't work"
        subtitle={view.message}
        footer={
          <View style={{ gap: space[3] }}>
            <Button
              label="Send a new link"
              block
              onPress={() => router.replace('/(auth)/forgot-password')}
            />
            <Button
              label="Back to sign in"
              variant="ghost"
              block
              onPress={() => router.replace('/(auth)/login')}
            />
          </View>
        }
      >
        <Text variant="bodySm" tone="secondary">
          Reset links expire an hour after they are sent, and each one works only once.
        </Text>
      </AuthScreen>
    );
  }

  if (view.name === 'done') {
    return (
      <AuthScreen
        title="Password updated"
        subtitle="Sign in with your new password."
        footer={
          <Button label="Sign in" block onPress={() => router.replace('/(auth)/login')} />
        }
      >
        <Text variant="bodySm" tone="secondary">
          You have been signed out everywhere else for safety.
        </Text>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Set a new password"
      subtitle="Pick something you haven't used here before."
      footer={
        <Button
          label="Save password"
          block
          loading={saving}
          disabled={!canSubmit}
          onPress={save}
        />
      }
    >
      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${MIN_PASSWORD} characters`}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={tooShort ? `Use at least ${MIN_PASSWORD} characters.` : undefined}
      />
      <Input
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it again"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={error ?? (mismatch ? "Those two don't match." : undefined)}
      />
    </AuthScreen>
  );
}
