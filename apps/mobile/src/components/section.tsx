import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors, radii, spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text variant="label" tone="muted" style={{ paddingHorizontal: spacing[1] }}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, padding: spacing[4], gap: spacing[3] }]}>
        {children}
      </View>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1, marginLeft: 12 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
