import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

export function Segmented<T extends string>({ value, options, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const { colors, radii } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.md }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            testID={`segment-${o.value}`}
            style={[styles.seg, { borderRadius: radii.sm }, selected && { backgroundColor: colors.primary }]}
          >
            <Text variant="caption" style={{ color: selected ? colors.primaryText : colors.textSecondary, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 3, borderWidth: StyleSheet.hairlineWidth },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
});
