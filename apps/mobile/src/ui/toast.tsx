import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { Icon } from './icon';
import { Text } from './text';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** ms; errors stay longer by default. */
  duration?: number;
}

interface ToastItem extends Required<ToastOptions> {
  id: number;
}

interface ToastApi {
  show: (o: ToastOptions | string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_VISIBLE = 3;

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (o: ToastOptions | string) => {
      const opts = typeof o === 'string' ? { message: o } : o;
      const tone = opts.tone ?? 'info';
      const item: ToastItem = { id: nextId.current++, message: opts.message, tone, duration: opts.duration ?? (tone === 'error' ? 6000 : 3500) };
      setItems((list) => [...list, item].slice(-MAX_VISIBLE));
      timers.current.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
      AccessibilityInfo.announceForAccessibility(item.message);
      return item.id;
    },
    [dismiss],
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const { colors, radii, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  if (!items.length) return null;

  const icon = { info: Info, success: CircleCheck, error: CircleAlert } as const;
  const tint = { info: colors.primary, success: colors.success, error: colors.danger } as const;

  return (
    <View pointerEvents="box-none" style={[styles.viewport, { top: insets.top + spacing[2], paddingHorizontal: spacing[4] }]}>
      {items.map((t) => (
        <Animated.View
          key={t.id}
          entering={reduceMotion ? undefined : FadeInUp.duration(200)}
          exiting={reduceMotion ? undefined : FadeOutUp.duration(160)}
          layout={reduceMotion ? undefined : LinearTransition.duration(180)}
          style={styles.item}
        >
          <Pressable
            onPress={() => onDismiss(t.id)}
            accessibilityRole="alert"
            accessibilityLabel={t.message}
            accessibilityHint="Double tap to dismiss"
            testID={`toast-${t.tone}`}
            style={[
              styles.toast,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radii.md, padding: spacing[3], gap: spacing[3] },
            ]}
          >
            <Icon as={icon[t.tone]} size="sm" color={tint[t.tone]} />
            <Text variant="caption" style={{ flex: 1, color: colors.textPrimary }}>
              {t.message}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', left: 0, right: 0, gap: 8, alignItems: 'center', zIndex: 1000 },
  item: { width: '100%', maxWidth: 520 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
