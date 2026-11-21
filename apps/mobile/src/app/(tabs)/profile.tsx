import { router } from 'expo-router';
import { Settings, UserRound } from 'lucide-react-native';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TopBar } from '@/components/top-bar';

export default function ProfileScreen() {
  return (
    <Screen
      header={<TopBar title="Profile" right={<IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />} />}
    >
      <EmptyState
        icon={UserRound}
        title="Your profile"
        message="Sign in to set up your profile, posts, reels and highlights."
        phase="Arrives in Phases 3–4 · Accounts & profiles"
      />
    </Screen>
  );
}
