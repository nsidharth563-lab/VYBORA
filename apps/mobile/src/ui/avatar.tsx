import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/** Story ring state: unseen story (brand gradient), seen (grey), close friends (green). */
export type StoryRing = 'none' | 'unseen' | 'seen' | 'closeFriends';

const PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96 };

// Brand-family fills for initials; all pass AA with white text.
const FILLS = ['#4F46E5', '#6D28D9', '#7C3AED', '#C2410C', '#047857', '#B45309', '#3730A3', '#BE185D'];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const chars = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [...(parts[0] ?? '?')].slice(0, 2);
  return chars.join('').toUpperCase();
}

export function fillFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return FILLS[h % FILLS.length]!;
}

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: AvatarSize;
  ring?: StoryRing;
  verified?: boolean;
  online?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Avatar({ name, uri, size = 'md', ring = 'none', verified, online, onPress, testID }: AvatarProps) {
  const { colors, gradients } = useAppTheme();
  const px = PX[size];
  const ringWidth = ring === 'none' ? 0 : px >= 64 ? 3 : 2;
  const gap = ring === 'none' ? 0 : px >= 64 ? 3 : 2;
  const outer = px + (ringWidth + gap) * 2;

  const label = [
    `${name}'s profile photo`,
    ring === 'unseen' && 'new story',
    ring === 'closeFriends' && 'close friends story',
    verified && 'verified',
    online && 'online',
  ]
    .filter(Boolean)
    .join(', ');

  const face = (
    <View style={[styles.face, { width: px, height: px, borderRadius: px / 2, backgroundColor: fillFor(name) }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} />
      ) : (
        <Text style={{ color: '#FFFFFF', fontSize: px * 0.38, lineHeight: px * 0.46, fontWeight: '600' }}>{initialsOf(name)}</Text>
      )}
    </View>
  );

  const ringColors: readonly [string, string, ...string[]] | null =
    ring === 'unseen' ? gradients.signal : ring === 'closeFriends' ? gradients.closeFriendsRing : ring === 'seen' ? [colors.borderStrong, colors.borderStrong] : null;

  const body = (
    <View style={{ width: outer, height: outer }}>
      {ringColors ? (
        <LinearGradient colors={ringColors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={[styles.center, { width: outer, height: outer, borderRadius: outer / 2 }]}>
          <View style={[styles.center, { width: outer - ringWidth * 2, height: outer - ringWidth * 2, borderRadius: outer / 2, backgroundColor: colors.background }]}>
            {face}
          </View>
        </LinearGradient>
      ) : (
        face
      )}
      {verified ? (
        <View style={[styles.badge, { right: -2, bottom: -2, backgroundColor: colors.background, borderRadius: 99 }]}>
          <BadgeCheck size={Math.max(14, px * 0.32)} color="#FFFFFF" fill={colors.primary} strokeWidth={2} />
        </View>
      ) : online ? (
        <View
          style={[
            styles.badge,
            { right: ringWidth, bottom: ringWidth, width: Math.max(10, px * 0.24), height: Math.max(10, px * 0.24), borderRadius: 99, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.background },
          ]}
        />
      ) : null}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={px < 44 ? (44 - px) / 2 : 0} testID={testID}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityRole="image" accessibilityLabel={label} testID={testID}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', padding: 1 },
});
