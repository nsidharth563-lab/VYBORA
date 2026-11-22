import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme';

interface CardProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Rounded surface. Pressable when `onPress` is given (then it needs an accessibilityLabel). */
export function Card({ onPress, accessibilityLabel, padded = true, style, testID, children }: PropsWithChildren<CardProps>) {
  const { colors, radii, spacing } = useAppTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: padded ? spacing[4] : 0,
    overflow: 'hidden',
  };
  if (!onPress) return <View style={[base, style]} testID={testID}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfaceMuted }, style]}
    >
      {children}
    </Pressable>
  );
}
