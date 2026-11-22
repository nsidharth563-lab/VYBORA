import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useAppTheme } from '@/theme';

export type IconComponent = ComponentType<LucideProps>;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'success' | 'onPrimary' | 'inherit';

const SIZES: Record<IconSize, number> = { xs: 14, sm: 18, md: 22, lg: 26, xl: 32 };

interface IconProps {
  as: IconComponent;
  size?: IconSize | number;
  tone?: IconTone;
  /** Explicit colour (overrides tone) — e.g. white on a gradient. */
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

/**
 * Single entry point for icons (Lucide set) so size and stroke weight stay
 * consistent. Icons are decorative by default — label the control, not the glyph.
 */
export function Icon({ as: Glyph, size = 'md', tone = 'primary', color, strokeWidth, filled }: IconProps) {
  const { colors } = useAppTheme();
  const px = typeof size === 'number' ? size : SIZES[size];
  const toneColor: Record<Exclude<IconTone, 'inherit'>, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.primary,
    danger: colors.danger,
    success: colors.success,
    onPrimary: colors.primaryText,
  };
  const c = color ?? (tone === 'inherit' ? colors.textPrimary : toneColor[tone]);
  return (
    <Glyph
      size={px}
      color={c}
      fill={filled ? c : 'none'}
      strokeWidth={strokeWidth ?? (px <= 16 ? 2.2 : 1.9)}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
