import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

interface EmptyStateProps {
  icon: ComponentType<LucideProps>;
  title: string;
  message: string;
  /** Roadmap phase that delivers this feature — shown so nothing pretends to work. */
  phase?: string;
}

export function EmptyState({ icon: Icon, title, message, phase }: EmptyStateProps) {
  const { colors, radii, spacing } = useAppTheme();
  return (
    <View style={[styles.wrap, { gap: spacing[3], padding: spacing[6] }]} accessibilityRole="summary">
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radii.xl }]}>
        <Icon size={28} color={colors.primary} strokeWidth={1.75} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="caption" tone="secondary" align="center" style={{ maxWidth: 320 }}>
        {message}
      </Text>
      {phase ? (
        <View style={[styles.pill, { borderColor: colors.border, borderRadius: radii.pill }]}>
          <Text variant="label" tone="muted">
            {phase.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  pill: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 4 },
});
