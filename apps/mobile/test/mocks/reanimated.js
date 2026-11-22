/**
 * Minimal Reanimated mock for Jest.
 *
 * Why not `react-native-reanimated/mock`? In Reanimated 4.7 it imports the real
 * entry point, which throws under jest-expo ("setCSSEventHandler is not available
 * in JSReanimated"), and expo-router's test helpers then silently fall back to an
 * empty module. This mock covers exactly the API surface VYBORA uses; extend it
 * when a component starts using something new (tests will fail loudly if not).
 *
 * Semantics: animations resolve to their target value immediately.
 */
const React = require('react');
const { View, Text, Image, ScrollView, FlatList } = require('react-native');

const identity = (v) => v;

function useSharedValue(initial) {
  const ref = React.useRef(null);
  if (ref.current === null) {
    const sv = { value: initial };
    sv.get = () => sv.value;
    sv.set = (v) => {
      sv.value = typeof v === 'function' ? v(sv.value) : v;
    };
    ref.current = sv;
  }
  return ref.current;
}

// Layout animation builders are chainable: FadeIn.duration(200).springify()...
function builder() {
  const b = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'build' ? () => ({}) : () => b),
    apply: () => b,
  });
  return b;
}

const createAnimatedComponent = (Component) =>
  React.forwardRef(function AnimatedComponent({ entering, exiting, layout, animatedProps, ...props }, ref) {
    return React.createElement(Component, { ...props, ...(animatedProps || {}), ref });
  });

const Animated = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  Image: createAnimatedComponent(Image),
  ScrollView: createAnimatedComponent(ScrollView),
  FlatList: createAnimatedComponent(FlatList),
  createAnimatedComponent,
};

const Easing = new Proxy({}, { get: () => (...args) => (args.length ? identity : identity) });

const layoutNames = [
  'FadeIn', 'FadeOut', 'FadeInUp', 'FadeOutUp', 'FadeInDown', 'FadeOutDown',
  'SlideInDown', 'SlideOutDown', 'SlideInUp', 'SlideOutUp', 'ZoomIn', 'ZoomOut',
  'LinearTransition', 'Layout',
];

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle: (fn) => fn(),
  useDerivedValue: (fn) => ({ value: fn(), get: () => fn() }),
  useAnimatedProps: (fn) => fn(),
  useAnimatedRef: () => React.useRef(null),
  useAnimatedScrollHandler: () => () => {},
  useReducedMotion: () => false,
  withTiming: (to, _cfg, cb) => {
    cb?.(true);
    return to;
  },
  withSpring: (to, _cfg, cb) => {
    cb?.(true);
    return to;
  },
  withDelay: (_ms, anim) => anim,
  withRepeat: (anim) => anim,
  withSequence: (...anims) => anims[anims.length - 1],
  cancelAnimation: () => {},
  interpolate: (v, input, output) => {
    const [i0, i1] = [input[0], input[input.length - 1]];
    const [o0, o1] = [output[0], output[output.length - 1]];
    return o0 + ((Math.min(Math.max(v, i0), i1) - i0) / (i1 - i0 || 1)) * (o1 - o0);
  },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  ...Object.fromEntries(layoutNames.map((n) => [n, builder()])),
};
