import * as Linking from 'expo-linking';
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

    /**
     * Without `redirectTo` the emailed link lands on the project's Site URL,
     * which defaults to `http://localhost:3000` — a page that does not exist,
     * on a host the phone cannot reach. Locally this never showed up, because
     * the local stack's Site URL happens to be the dev server.
     *
     * `createURL` resolves per platform: `savi://reset-password` in a dev
     * client or release build, `exp://…/--/reset-password` under Expo Go, and
     * the origin-relative path on web. Every value it can produce must also be
     * listed in the project's auth redirect allow-list, or Supabase silently
     * falls back to the Site URL and the link looks broken again.
     */
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    });
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
