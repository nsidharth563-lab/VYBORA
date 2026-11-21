import { Clapperboard } from 'lucide-react-native';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { TopBar } from '@/components/top-bar';

export default function ReelsScreen() {
  return (
    <Screen header={<TopBar title="Reels" />}>
      <EmptyState
        icon={Clapperboard}
        title="Full-screen reels"
        message="Swipe through short videos from creators around the world."
        phase="Arrives in Phase 7 · Reels"
      />
    </Screen>
  );
}
