import { View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

export type BadgeTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

/** Small status label ("NEW", "LIVE", "PRO") or count ("12", "99+"). */
export function Badge({ label, tone = 'brand', accessibilityLabel }: { label: string | number; tone?: BadgeTone; accessibilityLabel?: string }) {
  const { colors, radii } = useAppTheme();
  const text = typeof label === 'number' ? (label > 99 ? '99+' : String(label)) : label;
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    brand: { bg: colors.primary, fg: colors.primaryText },
    neutral: { bg: colors.surfaceMuted, fg: colors.textPrimary },
    success: { bg: colors.success, fg: colors.onSuccess },
    warning: { bg: colors.warning, fg: colors.onWarning },
    danger: { bg: colors.danger, fg: colors.onDanger },
  };
  const { bg, fg } = map[tone];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? String(label)}
      style={{ backgroundColor: bg, borderRadius: radii.pill, paddingHorizontal: 7, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Text variant="label" style={{ color: fg, fontWeight: '700' }}>
        {text}
      </Text>
    </View>
  );
}
