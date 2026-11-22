import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from '@/ui/text';

/** In-screen header used by tab screens (tabs hide the native header). */
export function TopBar({ title, left, right }: { title?: string; left?: ReactNode; right?: ReactNode }) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={[styles.bar, { paddingHorizontal: spacing[3], borderBottomColor: colors.border }]}>
      <View style={styles.side}>{left ?? (title ? <Text variant="title">{title}</Text> : null)}</View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  side: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  right: { gap: 2 },
});
