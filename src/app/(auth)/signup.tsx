import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { MIN_PASSWORD } from '@/features/auth/password';
import { authErrorMessage, supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const canSubmit =
    email.trim().length > 0 && password.length >= MIN_PASSWORD && !loading;

  async function signUp() {
    setError(null);
    setNotice(null);
    setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Read by the handle_new_user trigger to seed profiles.display_name.
      options: { data: { display_name: displayName.trim() || null } },
    });
    setLoading(false);

    if (err) {
      setError(authErrorMessage(err.message));
      return;
    }

    // With email confirmation enabled there is no session yet, and the guard
    // will not redirect. Saying so beats appearing to hang.
    if (!data.session) {
      setNotice('Check your inbox to confirm your email, then sign in.');
    }
  }

  return (
    <AuthScreen
      title="Create your account"
      subtitle="It takes about a minute."
      footer={
        <View style={{ gap: space[3] }}>
          <Button
            label="Create account"
            block
            loading={loading}
            disabled={!canSubmit}
            onPress={signUp}
          />
          {notice && (
            <Text variant="bodySm" tone="income" style={{ textAlign: 'center' }}>
              {notice}
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[2] }}>
            <Text variant="bodySm" tone="secondary">
              Already have an account?
            </Text>
            <Link href="/(auth)/login">
              <Text variant="bodySm" weight="600" tone="brand">
                Sign in
              </Text>
            </Link>
          </View>
        </View>
      }
    >
      <Input
        label="Name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="What should Savi call you?"
        autoComplete="name"
        hint="Optional"
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${MIN_PASSWORD} characters`}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={
          error ?? (passwordTooShort ? `Use at least ${MIN_PASSWORD} characters.` : undefined)
        }
      />
    </AuthScreen>
  );
}
