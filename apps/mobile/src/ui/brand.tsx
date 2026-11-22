import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { gradients } from '@vybora/ui';
import { Text } from './text';

/** VYBORA brand mark: the "signal V" with a discovery spark on the signature gradient. */
export function BrandMark({ size = 32 }: { size?: number }) {
  const [a, b, c] = gradients.signal;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="VYBORA logo">
      <Defs>
        <LinearGradient id="vyboraSignal" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="0.55" stopColor={b} />
          <Stop offset="1" stopColor={c} />
        </LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={230} fill="url(#vyboraSignal)" />
      <Path
        d="M292 318 L468 700 Q512 790 556 700 L700 388"
        fill="none"
        stroke="#fff"
        strokeWidth={100}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={752} cy={268} r={62} fill="#fff" />
    </Svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.4 }}>
      <BrandMark size={size * 1.35} />
      <Text variant="title" style={{ fontSize: size, lineHeight: size * 1.2, letterSpacing: 1.5 }}>
        VYBORA
      </Text>
    </View>
  );
}
