import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { Text } from './text';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  testID?: string;
}

/**
 * Bottom sheet. Closes on backdrop tap, Android back, and the iOS VoiceOver
 * escape gesture (two-finger scrub). Traps screen-reader focus while open
 * (accessibilityViewIsModal / aria-modal), so the backdrop is for sighted taps only.
 */
export function Sheet({ visible, onClose, title, testID, children }: PropsWithChildren<SheetProps>) {
  const { colors, radii, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent testID={testID}>
      {visible ? (
        <View style={styles.root}>
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} exiting={reduceMotion ? undefined : FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID={testID ? `${testID}-backdrop` : undefined}
            />
          </Animated.View>
          <Animated.View
            entering={reduceMotion ? undefined : SlideInDown.springify().damping(22).stiffness(220)}
            exiting={reduceMotion ? undefined : SlideOutDown.duration(180)}
            accessibilityViewIsModal
            aria-modal
            onAccessibilityEscape={onClose}
            testID={testID ? `${testID}-panel` : undefined}
            style={[
              styles.panel,
              {
                backgroundColor: colors.surfaceRaised,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                paddingBottom: Math.max(insets.bottom, spacing[4]),
                paddingHorizontal: spacing[4],
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            {title ? (
              <Text variant="heading" accessibilityRole="header" style={{ marginBottom: spacing[3] }}>
                {title}
              </Text>
            ) : null}
            {children}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
});
