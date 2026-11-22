import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { contrastRatio } from '@vybora/ui';
import { useState, type ReactElement } from 'react';
import { AccessibilityInfo, Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '@/theme';
import {
  Avatar,
  Button,
  Chip,
  fillFor,
  initialsOf,
  Sheet,
  Skeleton,
  SkeletonGroup,
  SwitchRow,
  Tabs,
  TextField,
  ToastProvider,
  useToast,
} from '@/ui';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );

describe('Button', () => {
  it('fires onPress and exposes an accessible label', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Follow" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Follow' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled or loading, and reports busy while loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await wrap(<Button label="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppThemeProvider>
          <Button label="Save" onPress={onPress} loading />
        </AppThemeProvider>
      </SafeAreaProvider>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
    expect(btn.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});

describe('TextField', () => {
  it('shows the error, exposes it as the hint, and announces it on iOS', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await wrap(<TextField label="Username" value="ab" onChangeText={() => {}} error="At least 3 characters." testID="u" />);
    expect(screen.getByTestId('u-error')).toHaveTextContent('At least 3 characters.');
    expect(screen.getByLabelText('Username').props.accessibilityHint).toBe('At least 3 characters.');
    expect(announce).toHaveBeenCalledWith('Username: At least 3 characters.');
  });

  it('toggles password visibility', async () => {
    await wrap(<TextField label="Password" value="secret123" onChangeText={() => {}} secureTextEntry />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });

  it('shows a character counter with a spoken label', async () => {
    function Bio() {
      const [v, setV] = useState('hi');
      return <TextField label="Bio" value={v} onChangeText={setV} maxLength={160} showCount />;
    }
    await wrap(<Bio />);
    expect(screen.getByLabelText('2 of 160 characters')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Bio'), 'hello');
    expect(screen.getByLabelText('5 of 160 characters')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('computes initials', async () => {
    expect(initialsOf('Nova Rao')).toBe('NR');
    expect(initialsOf('dj_kay')).toBe('DK');
    expect(initialsOf('Leo')).toBe('LE');
    expect(initialsOf('  ')).toBe('?');
  });

  it('uses deterministic fills that keep white initials AA', async () => {
    expect(fillFor('Nova')).toBe(fillFor('Nova'));
    for (const name of ['a', 'b', 'Nova', 'Mira Shah', 'संगीत', 'dj_kay', 'x', 'yy', 'zzz', 'Q']) {
      expect(contrastRatio('#FFFFFF', fillFor(name))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('describes ring, verification and presence to screen readers', async () => {
    await wrap(<Avatar name="Nova" ring="unseen" verified />);
    expect(screen.getByLabelText("Nova's profile photo, new story, verified")).toBeTruthy();
  });

  it('is a button when pressable', async () => {
    const onPress = jest.fn();
    await wrap(<Avatar name="Kai" ring="closeFriends" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: "Kai's profile photo, close friends story" }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Chip, SwitchRow, Tabs', () => {
  it('Chip reports selection state', async () => {
    function C() {
      const [on, setOn] = useState(false);
      return <Chip label="Music" selected={on} onPress={() => setOn((v) => !v)} />;
    }
    await wrap(<C />);
    const chip = screen.getByRole('togglebutton', { name: 'Music' });
    expect(chip.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(chip);
    expect(screen.getByRole('togglebutton', { name: 'Music' }).props.accessibilityState.selected).toBe(true);
  });

  it('SwitchRow toggles from anywhere on the row', async () => {
    const onChange = jest.fn();
    await wrap(<SwitchRow label="Private account" value={false} onValueChange={onChange} />);
    const row = screen.getByRole('switch', { name: 'Private account' });
    expect(row.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Tabs selects and announces counts', async () => {
    const onChange = jest.fn();
    await wrap(
      <Tabs
        accessibilityLabel="Profile content"
        value="posts"
        onChange={onChange}
        items={[
          { key: 'posts', label: 'Posts', count: 12 },
          { key: 'reels', label: 'Reels' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Posts, 12' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Reels' }));
    expect(onChange).toHaveBeenCalledWith('reels');
  });
});

describe('Sheet', () => {
  it('renders only when visible and closes from the backdrop', async () => {
    const onClose = jest.fn();
    const { rerender } = await wrap(
      <Sheet visible={false} onClose={onClose} title="Options">
        <RNText>Body</RNText>
      </Sheet>,
    );
    expect(screen.queryByText('Options')).toBeNull();
    await rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppThemeProvider>
          <Sheet visible onClose={onClose} title="Options" testID="s">
            <RNText>Body</RNText>
          </Sheet>
        </AppThemeProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Options' })).toBeTruthy();
    // Focus is trapped in the panel, so the backdrop is hidden from screen readers…
    expect(screen.queryByTestId('s-backdrop')).toBeNull();
    // …sighted users tap it,
    await fireEvent.press(screen.getByTestId('s-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // …and VoiceOver users use the escape gesture.
    await fireEvent(screen.getByTestId('s-panel'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  function Trigger({ message, tone }: { message: string; tone?: 'info' | 'success' | 'error' }) {
    const toast = useToast();
    return <Button label={`show ${message}`} onPress={() => toast.show({ message, tone })} />;
  }

  it('shows, announces and auto-dismisses', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await wrap(<Trigger message="Saved" tone="success" />);
    await fireEvent.press(screen.getByRole('button', { name: 'show Saved' }));
    expect(screen.getByRole('alert', { name: 'Saved' })).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Saved');
    await act(async () => {
      jest.advanceTimersByTime(3600);
    });
    expect(screen.queryByRole('alert', { name: 'Saved' })).toBeNull();
  });

  it('keeps errors longer, dismisses on tap, and caps the stack at 3', async () => {
    await wrap(<Trigger message="Oops" tone="error" />);
    const btn = screen.getByRole('button', { name: 'show Oops' });
    for (let i = 0; i < 5; i++) await fireEvent.press(btn);
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.getAllByRole('alert')).toHaveLength(3); // errors last 6s
    await fireEvent.press(screen.getAllByRole('alert')[0]!);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });
});

describe('Skeleton', () => {
  it('is hidden from screen readers; the group announces loading', async () => {
    await wrap(
      <SkeletonGroup label="Loading post">
        <Skeleton />
      </SkeletonGroup>,
    );
    expect(screen.getByRole('progressbar', { name: 'Loading post' }).props.accessibilityState).toMatchObject({ busy: true });
  });
});
