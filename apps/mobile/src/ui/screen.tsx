import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';

interface ScreenProps {
  header?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}

/** Page container: safe areas, themed background, readable max width on tablets/web. */
export function Screen({ header, scroll = false, edges = ['top'], contentStyle, children }: PropsWithChildren<ScreenProps>) {
  const { colors, spacing } = useAppTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, { padding: spacing[4] }, contentStyle]}>{children}</ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, { padding: spacing[4] }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.background }]}>
      {header}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center' },
});
