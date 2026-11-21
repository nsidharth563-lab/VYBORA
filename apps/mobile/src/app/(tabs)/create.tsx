import { Camera, Clapperboard, CircleDashed, Sparkles, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TopBar } from '@/components/top-bar';
import { useAppTheme } from '@/theme';

const FORMATS: { icon: ComponentType<LucideProps>; title: string; body: string; phase: string }[] = [
  { icon: Camera, title: 'Post', body: 'Photos, carousels and videos', phase: 'Phase 5' },
  { icon: Clapperboard, title: 'Reel', body: 'Vertical video with music & effects', phase: 'Phase 7' },
  { icon: CircleDashed, title: 'Story', body: 'Disappears after 24 hours', phase: 'Phase 6' },
  { icon: Sparkles, title: 'AI Studio', body: 'Captions, ideas and edits with AI', phase: 'Phase 9' },
];

/**
 * Create hub. Formats are listed as information (not buttons) until each
 * composer is built, so nothing here pretends to work.
 */
export default function CreateScreen() {
  const { colors, radii, spacing } = useAppTheme();
  return (
    <Screen header={<TopBar title="Create" />} scroll>
      <Text variant="body" tone="secondary" style={{ marginBottom: spacing[4] }}>
        Choose a format. Each composer unlocks as its phase ships.
      </Text>
      <View style={{ gap: spacing[3] }}>
        {FORMATS.map(({ icon: Icon, title, body, phase }) => (
          <View
            key={title}
            accessible
            accessibilityLabel={`${title}: ${body}. Coming in ${phase}.`}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, padding: spacing[4] }]}
          >
            <Icon size={24} color={colors.primary} strokeWidth={1.9} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{title}</Text>
              <Text variant="caption" tone="secondary">
                {body}
              </Text>
            </View>
            <Text variant="label" tone="muted">
              {phase.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth },
});
