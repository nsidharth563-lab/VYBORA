import { router } from 'expo-router';
import { Bell, MessageCircle, Newspaper } from 'lucide-react-native';
import { Wordmark } from '@/components/brand';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { TopBar } from '@/components/top-bar';

export default function HomeScreen() {
  return (
    <Screen
      header={
        <TopBar
          left={<Wordmark size={20} />}
          right={
            <>
              <IconButton icon={Bell} label="Notifications" onPress={() => router.push('/notifications')} />
              <IconButton icon={MessageCircle} label="Messages" onPress={() => router.push('/messages')} />
            </>
          }
        />
      }
    >
      <EmptyState
        icon={Newspaper}
        title="Your feed starts here"
        message="Posts and reels from people you follow, plus picks we think you'll love."
        phase="Arrives in Phase 5 · Feed"
      />
    </Screen>
  );
}
