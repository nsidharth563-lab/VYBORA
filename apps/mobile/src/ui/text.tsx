import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useAppTheme, typography } from '@/theme';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';
export type TextTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'onPrimary';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
}

const s = typography.size;

export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: TextProps) {
  const { colors, fonts } = useAppTheme();
  const variants: Record<TextVariant, TextStyle> = {
    display: { fontFamily: fonts.displayBold, fontSize: s['3xl'], lineHeight: s['3xl'] * 1.15, letterSpacing: -0.5 },
    title: { fontFamily: fonts.displayBold, fontSize: s['2xl'], lineHeight: s['2xl'] * 1.2, letterSpacing: -0.3 },
    heading: { fontFamily: fonts.displaySemibold, fontSize: s.lg, lineHeight: s.lg * 1.3 },
    body: { fontFamily: fonts.textRegular, fontSize: s.md, lineHeight: s.md * 1.45 },
    bodyStrong: { fontFamily: fonts.textSemibold, fontSize: s.md, lineHeight: s.md * 1.45 },
    caption: { fontFamily: fonts.textRegular, fontSize: s.sm, lineHeight: s.sm * 1.4 },
    label: { fontFamily: fonts.textMedium, fontSize: s.xs, lineHeight: s.xs * 1.3, letterSpacing: 0.4 },
  };
  const tones: Record<TextTone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.primary,
    danger: colors.danger,
    onPrimary: colors.primaryText,
  };
  return <RNText {...rest} style={[variants[variant], { color: tones[tone], textAlign: align }, style]} />;
}
