import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Text } from './text';

interface CodeInputProps {
  value: string;
  onChange: (v: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (code: string) => void;
  length?: number;
  error?: string | null;
  label?: string;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * One-time-code entry. A single hidden-styled TextInput (so iOS "From
 * Messages" and Android SMS autofill work, and screen readers see one field)
 * rendered as separate digit boxes.
 */
export function CodeInput({ value, onChange, onComplete, length = 6, error, label = 'Verification code', autoFocus = true, testID }: CodeInputProps) {
  const { colors, radii, fonts, spacing } = useAppTheme();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <Pressable onPress={() => ref.current?.focus()} accessible={false} style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  borderRadius: radii.md,
                  borderColor: error ? colors.danger : active ? colors.primary : colors.borderStrong,
                  borderWidth: active || error ? 2 : 1,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text style={{ fontFamily: fonts.displaySemibold, fontSize: 24 }}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={handle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          maxLength={length}
          autoFocus={autoFocus}
          caretHidden
          accessibilityLabel={label}
          accessibilityHint={error ?? `Enter the ${length}-digit code`}
          testID={testID}
          style={[StyleSheet.absoluteFill, styles.hiddenInput]}
        />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: { flex: 1, maxWidth: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  // Transparent but focusable and tappable — the boxes are the visuals.
  hiddenInput: { opacity: 0.011, color: 'transparent' },
});
