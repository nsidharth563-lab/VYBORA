import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

// react-native-web ignores thumbColor for the "on" state and uses its own teal.
const webThumb = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {};

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

/** Whole row toggles (bigger touch target); announced as a single switch. */
export function SwitchRow({ label, description, value, onValueChange, disabled, testID }: SwitchRowProps) {
  const { colors, spacing } = useAppTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={[styles.row, { gap: spacing[3], opacity: disabled ? 0.45 : 1 }]}
    >
      <View style={styles.text}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor="#FFFFFF"
        {...webThumb}
        ios_backgroundColor={colors.borderStrong}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
});
