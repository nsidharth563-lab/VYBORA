import { useEffect, type PropsWithChildren } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  circle?: number;
  style?: StyleProp<ViewStyle>;
}

/** Placeholder block. Gently pulses; static when the OS "reduce motion" setting is on. */
export function Skeleton({ width = '100%', height = 14, radius, circle, style }: SkeletonProps) {
  const { colors, radii } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const size = circle ? { width: circle, height: circle, borderRadius: circle / 2 } : { width, height, borderRadius: radius ?? radii.sm };
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: colors.border }, size, animated, style]}
    />
  );
}

/** Wrap skeletons so screen readers hear one "Loading…" instead of nothing. */
export function SkeletonGroup({ label = 'Loading', children }: PropsWithChildren<{ label?: string }>) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      {children}
    </View>
  );
}
