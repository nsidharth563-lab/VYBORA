import { Tabs } from 'expo-router/js-tabs';
import { VyboraTabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <VyboraTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="create" options={{ title: 'Create' }} />
      <Tabs.Screen name="reels" options={{ title: 'Reels' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
