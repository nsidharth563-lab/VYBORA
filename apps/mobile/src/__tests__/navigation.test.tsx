import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/stores/auth';
import { usePreferences } from '@/stores/preferences';
import { CODE, createFakeApi } from '../../test/fake-api';

// Real route files from src/app, real stores, fake HTTP backend.
const appDir = './src/app';
const REFRESH_KEY = 'vybora.refreshToken.v1';
const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

/** RNTL 14 events are async: awaiting them flushes resulting updates inside act(). */
const press = (el: Parameters<typeof fireEvent.press>[0]) => fireEvent.press(el);
const type = (testID: string, text: string) => fireEvent.changeText(screen.getByTestId(testID), text);

let api: ReturnType<typeof createFakeApi>;

beforeEach(() => {
  api = createFakeApi();
  globalThis.fetch = api.fetchImpl;
  secureStore.clear();
  usePreferences.setState({ theme: 'system' });
  useAuth.setState({ status: 'booting', user: null, accessToken: null, endedReason: null });
});

/** Boots the app already signed in (refresh token in the keychain, as after a previous launch). */
async function bootSignedIn(url = '/', userOverrides = {}, otherDevices: string[] = []) {
  const u = api.addUser(userOverrides);
  const s = api.startSession(u.me.id);
  for (const d of otherDevices) api.startSession(u.me.id, d);
  secureStore.set(REFRESH_KEY, s.refresh);
  await renderRouter(appDir, { initialUrl: url });
  return { user: u, session: s };
}

// ------------------------------------------------------------------ signed out

describe('signed out', () => {
  it('boots to the welcome screen and protects app routes', async () => {
    await renderRouter(appDir, { initialUrl: '/settings' });
    expect(await screen.findByText('Connect. Create. Discover.')).toBeTruthy();
    expect(screen.queryByText('Appearance'.toUpperCase())).toBeNull();
    expect(screen.getByTestId('go-sign-up')).toBeTruthy();
  });

  it('signs up, verifies the email with a code, and lands in the app', async () => {
    await renderRouter(appDir, { initialUrl: '/' });
    await press(await screen.findByTestId('go-sign-up'));

    // Client-side validation from the shared schema
    await press(await screen.findByTestId('signup-submit'));
    expect(screen.getByTestId('signup-email-error')).toHaveTextContent('Enter a valid email address.');

    await type('signup-email', 'new@example.com');
    await type('signup-name', 'Nova Rao');
    await type('signup-username', 'nova.rao');
    await type('signup-dob', '19990412');
    expect(screen.getByTestId('signup-dob').props.value).toBe('1999-04-12');
    await type('signup-password', 'violet-signal-2026');
    await press(screen.getByTestId('signup-submit'));

    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    expect(screen).toHavePathname('/verify');
    expect(secureStore.get(REFRESH_KEY)).toMatch(/^refresh-/);

    await type('verify-code', '000000');
    expect(await screen.findByTestId('verify-code-error')).toHaveTextContent("That code isn't right.");
    await type('verify-code', CODE);
    expect(await screen.findByText('Your feed starts here')).toBeTruthy();
    expect(useAuth.getState().user?.emailVerified).toBe(true);
  });

  it('shows server-side conflicts on the right field', async () => {
    api.addUser({ username: 'taken.name' });
    await renderRouter(appDir, { initialUrl: '/sign-up' });
    await type('signup-email', 'x@example.com');
    await type('signup-name', 'X');
    await type('signup-username', 'taken.name');
    await type('signup-dob', '1999-04-12');
    await type('signup-password', 'violet-signal-2026');
    await press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('signup-username-error')).toHaveTextContent('That username is taken.');
  });

  it('rejects under-13 sign-ups before calling the API', async () => {
    await renderRouter(appDir, { initialUrl: '/sign-up' });
    const recent = new Date(Date.now() - 5 * 365 * 86_400_000).toISOString().slice(0, 10);
    await type('signup-email', 'kid@example.com');
    await type('signup-dob', recent);
    await press(screen.getByTestId('signup-submit'));
    expect(screen.getByTestId('signup-dob-error')).toHaveTextContent('You must be at least 13 to use VYBORA.');
    expect(api.calls.some((c) => c.path === '/v1/auth/signup')).toBe(false);
  });

  it('logs in, showing a clear error for wrong credentials first', async () => {
    const u = api.addUser({ email: 'mira@example.com', displayName: 'Mira Shah' });
    await renderRouter(appDir, { initialUrl: '/log-in' });
    await type('login-identifier', 'mira@example.com');
    await type('login-password', 'wrong-password-x');
    await press(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(/That login didn't work/);

    await type('login-password', u.password);
    await press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Your feed starts here')).toBeTruthy();
    await press(screen.getByTestId('tab-profile'));
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Mira Shah');
  });

  it('signs in with a one-time code', async () => {
    api.addUser({ email: 'otp@example.com', emailVerified: true });
    await renderRouter(appDir, { initialUrl: '/code-login' });
    await type('code-identifier', 'otp@example.com');
    await press(screen.getByTestId('code-send'));
    expect(await screen.findByTestId('code-sent-to')).toBeTruthy();
    await type('code-input', CODE);
    expect(await screen.findByText('Your feed starts here')).toBeTruthy();
  });

  it('resets a forgotten password and returns to log in', async () => {
    api.addUser({ email: 'forgot@example.com' });
    await renderRouter(appDir, { initialUrl: '/forgot-password' });
    await type('forgot-identifier', 'forgot@example.com');
    await press(screen.getByTestId('forgot-send'));
    await type('forgot-code', CODE);
    await type('forgot-new-password', 'brand-new-signal-77');
    await press(screen.getByTestId('forgot-reset'));
    expect(await screen.findByRole('alert', { name: 'Password updated. Log in with your new password.' })).toBeTruthy();
    expect(screen).toHavePathname('/log-in');
  });
});

// ------------------------------------------------------------------ signed in

describe('signed in', () => {
  it('restores the session at launch and switches between the five tabs', async () => {
    await bootSignedIn('/');
    expect(await screen.findByText('Your feed starts here')).toBeTruthy();
    for (const tab of ['Home', 'Explore', 'Create', 'Reels', 'Profile']) expect(screen.getByLabelText(tab)).toBeTruthy();
    await press(screen.getByTestId('tab-explore'));
    expect(await screen.findByText('Find people')).toBeTruthy();
    await press(screen.getByTestId('tab-create'));
    expect(await screen.findByText('Choose a format. Each composer unlocks as its phase ships.')).toBeTruthy();
    await press(screen.getByTestId('tab-reels'));
    expect(await screen.findByText('Full-screen reels')).toBeTruthy();
  });

  it('header buttons open notifications and messages', async () => {
    await bootSignedIn('/');
    await press(await screen.findByLabelText('Notifications'));
    expect(await screen.findByText('No notifications yet')).toBeTruthy();
    expect(screen).toHavePathname('/notifications');
  });

  it('refreshes an expired access token transparently and retries', async () => {
    await bootSignedIn('/security');
    expect(await screen.findByTestId('session-current')).toBeTruthy();
    const refreshes = api.calls.filter((c) => c.path === '/v1/auth/refresh').length;
    api.state.expireNextAccess = true;
    await press(screen.getByTestId('go-change-password'));
    await screen.findByTestId('cp-current');
    await type('cp-current', 'violet-signal-2026');
    await type('cp-new', 'fresh-signal-2027');
    await press(screen.getByTestId('cp-submit'));
    expect(await screen.findByRole('alert', { name: 'Password changed.' })).toBeTruthy();
    expect(api.calls.filter((c) => c.path === '/v1/auth/refresh').length).toBe(refreshes + 1);
  });

  it('security: lists devices, signs one out, then signs out everywhere', async () => {
    await bootSignedIn('/security', {}, ['MacBook']);
    const laptop = api.sessions.find((x) => x.deviceName === 'MacBook')!;
    expect(await screen.findByTestId('session-current')).toHaveTextContent(/This device/);
    expect(screen.getByTestId(`session-${laptop.id}`)).toHaveTextContent(/MacBook/);

    await press(screen.getByTestId(`revoke-${laptop.id}`));
    expect(await screen.findByRole('alert', { name: 'Device signed out' })).toBeTruthy();
    expect(laptop.revoked).toBe(true);
    await waitFor(() => expect(screen.queryByTestId(`session-${laptop.id}`)).toBeNull());

    await press(screen.getByTestId('logout-all'));
    await press(await screen.findByTestId('confirm-logout-all'));
    expect(await screen.findByText('Connect. Create. Discover.')).toBeTruthy();
    expect(secureStore.has(REFRESH_KEY)).toBe(false);
  });

  it('settings: log out clears the keychain and returns to welcome', async () => {
    const { session } = await bootSignedIn('/settings');
    expect(await screen.findByTestId('contact-email')).toBeTruthy();
    await press(screen.getByTestId('logout'));
    expect(await screen.findByText('Connect. Create. Discover.')).toBeTruthy();
    expect(session.revoked).toBe(true);
    expect(secureStore.has(REFRESH_KEY)).toBe(false);
  });

  it('a revoked session sends the user back to welcome', async () => {
    const { session } = await bootSignedIn('/settings');
    await screen.findByTestId('contact-email');
    session.revoked = true;
    await press(screen.getByTestId('open-security'));
    expect(await screen.findByText('Connect. Create. Discover.')).toBeTruthy();
  });

  it('delete account: confirms with password, signs out, explains the grace period', async () => {
    await bootSignedIn('/delete-account');
    await type('delete-password', 'violet-signal-2026');
    await press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByTestId('ended-reason')).toHaveTextContent(/scheduled for deletion/);
  });

  it('social sign-ups must complete the age gate first', async () => {
    await bootSignedIn('/', { needsProfileCompletion: true, displayName: 'Gita Rao' });
    expect(await screen.findByText('Almost there, Gita')).toBeTruthy();
    await type('complete-dob', '1999-04-12');
    await press(screen.getByTestId('complete-submit'));
    expect(await screen.findByText('Your feed starts here')).toBeTruthy();
  });

  it('settings: theme switch persists and server status loads', async () => {
    await bootSignedIn('/settings');
    await press(await screen.findByTestId('segment-dark'));
    expect(usePreferences.getState().theme).toBe('dark');
    await waitFor(() => expect(screen.getByTestId('segment-dark').props.accessibilityState).toMatchObject({ checked: true }));
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent('All systems operational'));
    expect(screen.getByText('up · 3 ms')).toBeTruthy();
  });

  it('settings: offline message and retry', async () => {
    api.state.health = 'down';
    await bootSignedIn('/settings');
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent(/Degraded \(503\)/));
    api.state.health = 'ok';
    await press(screen.getByLabelText('Check server status again'));
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent('All systems operational'));
  });

  it('unknown routes show the not-found screen', async () => {
    await bootSignedIn('/nope/nothing');
    expect(await screen.findByText("This page doesn't exist")).toBeTruthy();
  });

  it('design system gallery opens from Settings and works', async () => {
    await bootSignedIn('/settings');
    await press(await screen.findByTestId('open-design-system'));
    expect(await screen.findByTestId('design-system')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('field-username'), 'ab');
    expect(screen.getByTestId('field-username-error')).toHaveTextContent('At least 3 characters.');
    await press(screen.getByRole('tab', { name: 'Reels, 42' }));
    expect(screen.getByTestId('tab-selection')).toHaveTextContent('Showing: reels');
    await press(screen.getByTestId('btn-toast-info'));
    expect(screen.getByRole('alert', { name: 'Heads up — this is a toast.' })).toBeTruthy();
    await press(screen.getByTestId('btn-sheet'));
    expect(await screen.findByRole('header', { name: 'Delete account?' })).toBeTruthy();
    await press(screen.getByTestId('sheet-cancel'));
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Delete account?' })).toBeNull());
  });
});
