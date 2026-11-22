import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Extra context for screen readers, e.g. "Follows @nova". */
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 };
const PAD: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 22 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const { colors, gradients, radii, fonts } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inactive = disabled || loading;

  const fg: Record<ButtonVariant, string> = {
    primary: '#FFFFFF',
    secondary: colors.primary,
    outline: colors.textPrimary,
    ghost: colors.primary,
    danger: colors.onDanger,
  };
  const bg: Record<ButtonVariant, string | undefined> = {
    primary: undefined, // gradient
    secondary: colors.primarySoft,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.danger,
  };

  const content: ReactNode = loading ? (
    <ActivityIndicator color={fg[variant]} accessibilityElementsHidden importantForAccessibility="no" />
  ) : (
    <View style={[styles.row, iconPosition === 'right' && styles.rowReverse]}>
      {icon ? <Icon as={icon} size={size === 'sm' ? 'sm' : 'md'} color={fg[variant]} /> : null}
      <Text
        variant="bodyStrong"
        numberOfLines={1}
        style={{ color: fg[variant], fontFamily: fonts.textSemibold, fontSize: size === 'sm' ? 14 : 16 }}
      >
        {label}
      </Text>
    </View>
  );

  const shape: ViewStyle = {
    height: HEIGHT[size],
    paddingHorizontal: PAD[size],
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Animated.View style={[animated, fullWidth && styles.full, { opacity: disabled ? 0.45 : 1 }, style]}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => {
          if (!reduceMotion) scale.set(withSpring(0.97, { damping: 18, stiffness: 320 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 18, stiffness: 320 }));
        }}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        hitSlop={size === 'sm' ? 4 : 0}
        testID={testID}
        style={({ pressed }) => [
          { minHeight: 44 },
          pressed && (variant === 'ghost' || variant === 'outline') && { backgroundColor: colors.surfaceMuted, borderRadius: radii.md },
        ]}
      >
        {variant === 'primary' ? (
          <LinearGradient colors={gradients.signalStrong} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              shape,
              { backgroundColor: bg[variant] },
              variant === 'outline' && { borderWidth: 1, borderColor: colors.borderStrong },
            ]}
          >
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowReverse: { flexDirection: 'row-reverse' },
  full: { alignSelf: 'stretch' },
});
