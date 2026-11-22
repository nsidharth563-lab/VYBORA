import { ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '@/theme';

export function Spinner({ size = 'small', label = 'Loading' }: { size?: 'small' | 'large'; label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}
