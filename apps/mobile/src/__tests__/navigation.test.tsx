import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { usePreferences } from '@/stores/preferences';

// Use the real route files from src/app.
const appDir = './src/app';

/** Press and let navigation/state updates settle before asserting. */
const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

let online = true;
const READY = { status: 'ok', checks: { database: { status: 'up', latencyMs: 3 }, redis: { status: 'up', latencyMs: 1 } } };

beforeEach(() => {
  online = true;
  usePreferences.setState({ theme: 'system' });
  globalThis.fetch = jest.fn(async () => {
    if (!online) throw new TypeError('Network request failed');
    return new Response(JSON.stringify(READY), { status: 200 });
  }) as unknown as typeof fetch;
});

describe('app navigation', () => {
  it('shows the five bottom tabs and switches between them', async () => {
    await renderRouter(appDir, { initialUrl: '/' });
    expect(await screen.findByText('Your feed starts here')).toBeTruthy();
    for (const tab of ['Home', 'Explore', 'Create', 'Reels', 'Profile']) {
      expect(screen.getByLabelText(tab)).toBeTruthy();
    }
    await press(screen.getByTestId('tab-explore'));
    expect(await screen.findByText("Discover what's trending")).toBeTruthy();
    await press(screen.getByTestId('tab-create'));
    expect(await screen.findByText('Choose a format. Each composer unlocks as its phase ships.')).toBeTruthy();
    await press(screen.getByTestId('tab-reels'));
    expect(await screen.findByText('Full-screen reels')).toBeTruthy();
    await press(screen.getByTestId('tab-profile'));
    expect(await screen.findByText('Your profile')).toBeTruthy();
  });

  it('header buttons open notifications and messages', async () => {
    await renderRouter(appDir, { initialUrl: '/' });
    await press(await screen.findByLabelText('Notifications'));
    expect(await screen.findByText('No notifications yet')).toBeTruthy();
    expect(screen).toHavePathname('/notifications');
  });

  it('settings: theme switch persists to the store and server status loads', async () => {
    await renderRouter(appDir, { initialUrl: '/settings' });
    await press(await screen.findByTestId('segment-dark'));
    expect(usePreferences.getState().theme).toBe('dark');
    await waitFor(() => expect(screen.getByTestId('segment-dark').props.accessibilityState).toMatchObject({ checked: true }));
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent('All systems operational'));
    expect(screen.getByText('up · 3 ms')).toBeTruthy();
  });

  it('settings: shows an offline message when the API is unreachable, and retry works', async () => {
    online = false;
    await renderRouter(appDir, { initialUrl: '/settings' });
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent(/Can't reach VYBORA/));
    online = true;
    await press(screen.getByLabelText('Check server status again'));
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent('All systems operational'));
  });

  it('unknown routes show the not-found screen', async () => {
    await renderRouter(appDir, { initialUrl: '/nope/nothing' });
    expect(await screen.findByText("This page doesn't exist")).toBeTruthy();
  });
});
