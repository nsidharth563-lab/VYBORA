import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { Text } from './text';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
}

/** Underline tabs for in-screen sections (e.g. Posts · Reels · Saved) with an animated indicator. */
export function Tabs<K extends string>({ items, value, onChange, accessibilityLabel }: TabsProps<K>) {
  const { colors, fonts } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const active = layouts[value];

  const indicator = useAnimatedStyle(() => {
    const d = reduceMotion ? 0 : 220;
    return {
      opacity: active ? 1 : 0,
      transform: [{ translateX: withTiming(active?.x ?? 0, { duration: d }) }],
      width: withTiming(active?.width ?? 0, { duration: d }),
    };
  }, [active, reduceMotion]);

  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.bar, { borderBottomColor: colors.border }]}>
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width } = e.nativeEvent.layout;
              setLayouts((l) => (l[item.key]?.x === x && l[item.key]?.width === width ? l : { ...l, [item.key]: { x, width } }));
            }}
            accessibilityRole="tab"
            accessibilityLabel={item.count != null ? `${item.label}, ${item.count}` : item.label}
            accessibilityState={{ selected }}
            testID={`tab-${item.key}`}
            style={styles.tab}
          >
            <Text
              variant="body"
              style={{ fontFamily: selected ? fonts.textSemibold : fonts.textMedium, color: selected ? colors.textPrimary : colors.textSecondary }}
            >
              {item.label}
              {item.count != null ? <Text variant="caption" tone="muted">{`  ${item.count}`}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.textPrimary }, indicator]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  indicator: { position: 'absolute', left: 0, bottom: 0, height: 2, borderRadius: 1 },
});
