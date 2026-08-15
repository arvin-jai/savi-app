import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { space } from '@/theme/tokens';

export default function Welcome() {
  return (
    <AuthScreen
      title="Savi"
      subtitle="Spend smarter. Plan easier. Live better."
      footer={
        <View style={{ gap: space[3] }}>
          <Button label="Get started" block onPress={() => router.push('/(auth)/signup')} />
          <Button
            label="I already have an account"
            variant="ghost"
            block
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      }
    >
      <Text variant="bodyLg" tone="secondary">
        Savi keeps your money and your schedule in one place, so you can see what you can
        actually spend — without doing the maths yourself.
      </Text>
    </AuthScreen>
  );
}
