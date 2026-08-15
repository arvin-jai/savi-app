/**
 * Shared shell for the five auth screens (D§67).
 *
 * Keeps the ambient background, spacing, and keyboard handling in one place so
 * the screens themselves are just their content — and so they cannot drift
 * apart visually, which is what §55 exists to prevent for cards.
 */

import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { Text } from '@/components/ui/Text';
import { layout, space } from '@/theme/tokens';

export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              padding: layout.pagePaddingMobile,
              gap: space[6],
              maxWidth: 440,
              width: '100%',
              alignSelf: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: space[2] }}>
              <Text variant="h1">{title}</Text>
              {subtitle && (
                <Text variant="body" tone="secondary">
                  {subtitle}
                </Text>
              )}
            </View>

            <View style={{ gap: space[4] }}>{children}</View>

            {footer && <View style={{ gap: space[3] }}>{footer}</View>}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
