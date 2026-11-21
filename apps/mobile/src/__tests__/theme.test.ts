import { darkTheme, lightTheme } from '@vybora/ui';
import { buildTheme, resolveScheme } from '@/theme';
import { usePreferences } from '@/stores/preferences';

describe('theme', () => {
  it('resolves system preference from the OS', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
  });
  it('explicit preference overrides the OS', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
  it('builds palettes from @vybora/ui tokens', () => {
    expect(buildTheme('dark').colors).toBe(darkTheme);
    expect(buildTheme('light').colors).toBe(lightTheme);
  });
  it('preferences store updates', () => {
    usePreferences.getState().setTheme('dark');
    expect(usePreferences.getState().theme).toBe('dark');
  });
});
