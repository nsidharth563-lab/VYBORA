import { MessageCircle } from 'lucide-react-native';
import { EmptyState } from '@/ui/empty-state';
import { Screen } from '@/ui/screen';

export default function MessagesScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon={MessageCircle}
        title="Your messages"
        message="Chats, groups and voice notes, delivered in real time."
        phase="Arrives in Phase 8 · Messaging"
      />
    </Screen>
  );
}
