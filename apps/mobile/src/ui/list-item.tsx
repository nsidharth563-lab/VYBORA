import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconComponent;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}

/** Settings / menu row. Shows a chevron when navigable. */
export function ListItem({ title, subtitle, icon, leading, trailing, onPress, destructive, testID }: ListItemProps) {
  const { colors, spacing } = useAppTheme();
  const body = (
    <>
      {leading ?? (icon ? <Icon as={icon} size="md" tone={destructive ? 'danger' : 'secondary'} /> : null)}
      <View style={styles.text}>
        <Text variant="body" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon as={ChevronRight} size="sm" tone="muted" /> : null)}
    </>
  );
  const rowStyle = [styles.row, { gap: spacing[3], paddingVertical: spacing[3] }];
  if (!onPress) return <View style={rowStyle} testID={testID}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      testID={testID}
      style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  text: { flex: 1, gap: 2 },
});
