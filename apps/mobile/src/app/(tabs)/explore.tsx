import { Compass } from 'lucide-react-native';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { TopBar } from '@/components/top-bar';

export default function ExploreScreen() {
  return (
    <Screen header={<TopBar title="Explore" />}>
      <EmptyState
        icon={Compass}
        title="Discover what's trending"
        message="Search people, reels, hashtags, music and communities."
        phase="Arrives in Phase 12 · Search & discovery"
      />
    </Screen>
  );
}
