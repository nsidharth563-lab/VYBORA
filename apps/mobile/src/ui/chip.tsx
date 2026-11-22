import { Pressable } from 'react-native';
import { useAppTheme } from '@/theme';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconComponent;
  testID?: string;
}

/** Toggleable filter/interest pill. */
export function Chip({ label, selected = false, onPress, icon, testID }: ChipProps) {
  const { colors, radii } = useAppTheme();
  const fg = selected ? colors.primary : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.borderStrong,
        backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      {icon ? <Icon as={icon} size="xs" color={fg} /> : null}
      <Text variant="caption" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
