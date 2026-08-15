/**
 * Bottom sheet (D§9 Glass 3 — Elevated, D§18 28px radius).
 *
 * One of the four surfaces A6 permits blur on: bounded, non-scrolling, and
 * never more than one on screen. The M0 spike disqualified blur inside lists,
 * not here.
 *
 * Built on RN Modal rather than a sheet library. The behaviour needed is a
 * scrim, a slide-up, a drag-free dismiss, and keyboard avoidance — a native
 * gesture-driven sheet would add a dependency and a new-architecture surface
 * for something Quick Add doesn't require.
 */

import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { duration, opacity, radius, space, z } from '@/theme/tokens';

export function GlassSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      // D§43: most interactions 150–250ms. Decelerate on entry so it settles
      // rather than snapping.
      duration: visible ? duration.normal : duration.fast,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', zIndex: z.sheet }}>
        {/* Scrim. Tapping outside closes — Quick Add is not a form you can
            trap someone in. */}
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{
            ...StyleSheetAbsolute,
            backgroundColor: `rgba(0,0,0,${opacity.scrim})`,
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={{
              maxHeight: height * 0.9,
              backgroundColor: theme.glass.elevated.fallback,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: theme.glass.elevated.border,
              paddingBottom: Math.max(insets.bottom, space[4]),
              opacity: slide,
              transform: [
                { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
            }}
          >
            {/* Grabber. Visual affordance only — dismissal is the scrim or the
                Cancel action, both of which are reachable by screen readers. */}
            <View style={{ alignItems: 'center', paddingTop: space[3] }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: radius.full,
                  backgroundColor: theme.color.textSecondary,
                  opacity: 0.3,
                }}
              />
            </View>

            <View style={{ paddingHorizontal: space[5], paddingTop: space[4] }}>
              <Text variant="h3">{title}</Text>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: space[5], gap: space[4] }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>

            {footer && (
              <View style={{ paddingHorizontal: space[5], gap: space[3] }}>{footer}</View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
