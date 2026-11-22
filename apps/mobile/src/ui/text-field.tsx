import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useId, useState, type ComponentRef, type Ref } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useAppTheme } from '@/theme';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string;
  error?: string | null;
  helper?: string;
  leftIcon?: IconComponent;
  /** Shows "12/160" and enforces the limit. */
  maxLength?: number;
  showCount?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({
  label,
  error,
  helper,
  leftIcon,
  secureTextEntry,
  maxLength,
  showCount,
  multiline,
  value,
  onFocus,
  onBlur,
  testID,
  ref,
  ...rest
}: TextFieldProps) {
  const { colors, radii, fonts, spacing } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const id = useId();

  // iOS has no live regions: announce new errors explicitly.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${label}: ${error}`);
  }, [error, label]);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <View style={{ gap: spacing[1] + 2 }}>
      <Text variant="caption" tone="secondary" nativeID={`${id}-label`} style={{ fontFamily: fonts.textMedium }}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor,
            borderWidth: focused || error ? 2 : 1,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            paddingHorizontal: focused || error ? spacing[3] - 1 : spacing[3],
            minHeight: multiline ? 96 : 48,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {leftIcon ? (
          <View style={multiline ? { paddingTop: 12 } : undefined}>
            <Icon as={leftIcon} size="sm" tone="muted" />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          {...rest}
          testID={testID}
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry && hidden}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${id}-label`}
          accessibilityHint={error ?? helper}
          accessibilityState={{ disabled: rest.editable === false }}
          aria-invalid={!!error}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontFamily: fonts.textRegular,
              paddingVertical: multiline ? 12 : 0,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            style={styles.trailing}
          >
            <Icon as={hidden ? Eye : EyeOff} size="sm" tone="secondary" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.footer}>
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ flex: 1 }} testID={testID ? `${testID}-error` : undefined}>
            {error}
          </Text>
        ) : helper ? (
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {helper}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {showCount && maxLength ? (
          <Text
            variant="caption"
            tone={length >= maxLength ? 'danger' : 'muted'}
            accessibilityLabel={`${length} of ${maxLength} characters`}
          >
            {length}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, fontSize: 16, minHeight: 44 },
  trailing: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  footer: { flexDirection: 'row', gap: 8, minHeight: 18 },
});
