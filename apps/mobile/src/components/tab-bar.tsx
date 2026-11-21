import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Clapperboard, Compass, House, Plus, UserRound, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

const ICONS: Record<string, { icon: ComponentType<LucideProps>; label: string }> = {
  index: { icon: House, label: 'Home' },
  explore: { icon: Compass, label: 'Explore' },
  create: { icon: Plus, label: 'Create' },
  reels: { icon: Clapperboard, label: 'Reels' },
  profile: { icon: UserRound, label: 'Profile' },
};

/** VYBORA bottom navigation: five tabs, Create rendered as the signature gradient button. */
export function VyboraTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { colors, gradients, radii } = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {state.routes.map((route, index) => {
        const meta = ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const onPress = () => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          if (!focused) navigateToTab(route.key);
        };
        const Icon = meta.icon;

        if (route.name === 'create') {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel="Create"
              accessibilityState={{ selected: focused }}
              style={styles.item}
              testID="tab-create"
            >
              <LinearGradient
                colors={gradients.signal}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.create, { borderRadius: radii.md }]}
              >
                <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
              </LinearGradient>
            </Pressable>
          );
        }

        const tint = focused ? colors.textPrimary : colors.textMuted;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            style={styles.item}
            testID={`tab-${route.name}`}
          >
            <Icon size={24} color={tint} strokeWidth={focused ? 2.3 : 1.8} />
            <Text variant="label" style={{ color: tint, marginTop: 3 }}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  create: { width: 48, height: 36, alignItems: 'center', justifyContent: 'center' },
});
