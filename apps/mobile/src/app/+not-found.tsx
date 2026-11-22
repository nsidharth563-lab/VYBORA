import { Link, Stack } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { View } from 'react-native';
import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';

export default function NotFound() {
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState icon={SearchX} title="This page doesn't exist" message="The link may be broken or the content was removed." />
      <View style={{ alignItems: 'center', paddingBottom: 32 }}>
        <Link href="/" accessibilityRole="link">
          <Text variant="bodyStrong" tone="accent">
            Go to Home
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
