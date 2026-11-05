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

import { useEffect, useState } from 'react';
import { X } from 'lucide-react-native';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
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
  fullScreen = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Use for focused ledger flows that should feel like their own workspace. */
  fullScreen?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [slide] = useState(() => new Animated.Value(0));

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
      <View style={{ flex: 1, zIndex: z.sheet }}>
        {/* Scrim. Tapping outside closes — Quick Add is not a form you can
            trap someone in.

            It stays a sibling BEHIND the keyboard-avoiding layer rather than
            wrapping it, so the tappable area is everything the sheet does not
            cover. The layer above sets pointerEvents="box-none" precisely so
            those taps reach this. */}
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{
            ...StyleSheetAbsolute,
            backgroundColor: `rgba(0,0,0,${opacity.scrim})`,
          }}
        />

        {/**
         * Keyboard avoidance, on BOTH platforms.
         *
         * `behavior` used to be undefined on Android, on the usual reasoning
         * that `android:windowSoftInputMode="adjustResize"` in the manifest
         * handles it. It does — for the Activity. It does NOT apply inside a
         * React Native `Modal`, and `statusBarTranslucent` puts this one
         * outside the resized area entirely, so the keyboard opened straight
         * over the sheet: on Quick Add that buried the Save button and the
         * amount field under the keypad.
         *
         * `padding` with `flex: 1` and `justifyContent: 'flex-end'` is what
         * moves it: the layer shrinks by the keyboard's height and the sheet
         * stays pinned to the new bottom edge. The sheet's own ScrollView then
         * scrolls whatever no longer fits, rather than the content being cut
         * off.
         *
         * `box-none` so this layer is not itself a tap target — without it the
         * full-height layer would swallow every tap meant for the scrim and
         * tap-outside-to-close would silently stop working.
         */}
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Animated.View
            style={{
              maxHeight: fullScreen ? height : height * 0.9,
              height: fullScreen ? height : undefined,
              width: '100%',
              maxWidth: 520,
              alignSelf: 'center',
              // `maxHeight` is measured against the FULL window, so with the
              // keyboard up it can exceed what the shrunken layer above still
              // has. Without this the sheet overflows its parent and the
              // footer goes back under the keyboard, which is the bug this
              // whole block exists to fix.
              flexShrink: 1,
              backgroundColor: theme.glass.elevated.fallback,
              borderTopLeftRadius: fullScreen ? 0 : 28,
              borderTopRightRadius: fullScreen ? 0 : 28,
              borderWidth: 1,
              borderBottomWidth: fullScreen ? 1 : 0,
              borderColor: theme.glass.elevated.border,
              paddingTop: fullScreen ? insets.top : 0,
              paddingBottom: Math.max(insets.bottom, space[4]),
              opacity: slide,
              transform: [
                { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
            }}
          >
            {/* Grabber. Visual affordance only — dismissal is the scrim or the
                Cancel action, both of which are reachable by screen readers. */}
            {!fullScreen && (
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
            )}

            <View
              style={{
                minHeight: 64,
                paddingHorizontal: space[5],
                paddingTop: fullScreen ? space[2] : space[4],
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.color.surfaceSecondary,
                }}
              >
                <X size={18} color={theme.color.textPrimary} />
              </Pressable>
              <View style={{ flex: 1 }}>
                {fullScreen && (
                  <Text variant="micro" tone="secondary" style={{ letterSpacing: 0.8 }}>
                    LEDGER ENTRY
                  </Text>
                )}
                <Text variant="h3">{title}</Text>
              </View>
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
