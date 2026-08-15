import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { authErrorMessage, supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function signIn() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (err) {
      setError(authErrorMessage(err.message));
      return;
    }
    // The root guard redirects on session change; no manual navigation needed.
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <View style={{ gap: space[3] }}>
          <Button label="Sign in" block loading={loading} disabled={!canSubmit} onPress={signIn} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[2] }}>
            <Text variant="bodySm" tone="secondary">
              New to Savi?
            </Text>
            <Link href="/(auth)/signup">
              <Text variant="bodySm" weight="600" tone="brand">
                Create an account
              </Text>
            </Link>
          </View>
        </View>
      }
    >
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
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        error={error ?? undefined}
      />
      <Button
        label="Forgot password?"
        variant="ghost"
        size="sm"
        onPress={() => router.push('/(auth)/forgot-password')}
      />
    </AuthScreen>
  );
}
