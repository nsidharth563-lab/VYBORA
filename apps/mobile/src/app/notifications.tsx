import { Bell } from 'lucide-react-native';
import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';

export default function NotificationsScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        message="Follows, likes, comments, mentions and earnings will show up here."
        phase="Arrives in Phase 12 · Notifications"
      />
    </Screen>
  );
}
