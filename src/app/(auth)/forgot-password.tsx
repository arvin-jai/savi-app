import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { authErrorMessage, supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendReset() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);

    if (err) {
      setError(authErrorMessage(err.message));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`If an account exists for ${email.trim()}, a reset link is on its way.`}
        footer={<Button label="Back to sign in" block onPress={() => router.replace('/(auth)/login')} />}
      >
        <Text variant="bodySm" tone="secondary">
          The link expires in an hour. If it doesn&apos;t arrive, check your spam folder.
        </Text>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <View style={{ gap: space[3] }}>
          <Button
            label="Send reset link"
            block
            loading={loading}
            disabled={email.trim().length === 0 || loading}
            onPress={sendReset}
          />
          <Button label="Back" variant="ghost" block onPress={() => router.back()} />
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
        error={error ?? undefined}
      />
    </AuthScreen>
  );
}
