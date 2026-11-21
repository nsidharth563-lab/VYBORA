import type { ComponentType } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { useAppTheme } from '@/theme';

interface IconButtonProps {
  icon: ComponentType<LucideProps>;
  label: string;
  onPress: () => void;
  size?: number;
}

/** 44pt minimum touch target (Apple HIG / Material a11y). */
export function IconButton({ icon: Icon, label, onPress, size = 24 }: IconButtonProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <Icon size={size} color={colors.textPrimary} strokeWidth={1.9} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } });
