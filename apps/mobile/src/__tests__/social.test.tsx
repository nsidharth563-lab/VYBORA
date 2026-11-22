import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { uploadImage } from '@/lib/upload';
import { useAuth } from '@/stores/auth';
import { createFakeApi } from '../../test/fake-api';

const appDir = './src/app';
const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const press = (el: Parameters<typeof fireEvent.press>[0]) => fireEvent.press(el);
const type = (testID: string, text: string) => fireEvent.changeText(screen.getByTestId(testID), text);

let api: ReturnType<typeof createFakeApi>;
beforeEach(() => {
  api = createFakeApi();
  globalThis.fetch = api.fetchImpl;
  secureStore.clear();
  useAuth.setState({ status: 'booting', user: null, accessToken: null, endedReason: null, landing: null });
});

async function bootAs(url: string, overrides = {}) {
  const me = api.addUser({ username: 'me.nova', displayName: 'Nova Rao', ...overrides });
  const s = api.startSession(me.me.id);
  secureStore.set('vybora.refreshToken.v1', s.refresh);
  await renderRouter(appDir, { initialUrl: url });
  return me;
}

describe('people & follows', () => {
  it('search → open profile → follow a public account', async () => {
    const kai = api.addUser({ username: 'kai.beats', displayName: 'Kai Mensah' });
    await bootAs('/explore');
    await type('search-input', 'kai');
    expect(await screen.findByTestId('user-kai.beats')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Kai Mensah, @kai.beats' }));
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Kai Mensah');
    await press(screen.getByTestId('follow-kai.beats'));
    await waitFor(() => expect(screen.getByTestId('follow-kai.beats')).toHaveTextContent('Following'));
    expect(api.follows.get(`${[...api.users.values()].find((u) => u.me.username === 'me.nova')!.me.id}->${kai.me.id}`)).toBe('ACCEPTED');
  });

  it('private accounts: shows "Requested" and hides content', async () => {
    api.addUser({ username: 'priv.mira', displayName: 'Mira', isPrivate: true } as never);
    const mira = [...api.users.values()].find((u) => u.me.username === 'priv.mira')!;
    mira.me.isPrivate = true;
    await bootAs('/u/priv.mira');
    expect(await screen.findByText('This account is private')).toBeTruthy();
    await press(screen.getByTestId('follow-priv.mira'));
    await waitFor(() => expect(screen.getByTestId('follow-priv.mira')).toHaveTextContent('Requested'));
  });

  it('follow back appears for people who follow you', async () => {
    const leo = api.addUser({ username: 'leo.draws', displayName: 'Leo' });
    const me = await bootAs('/u/leo.draws');
    api.follow(leo.me.id, me.me.id);
    // refresh profile
    await renderRouter(appDir, { initialUrl: '/u/leo.draws' });
    expect(await screen.findByTestId('follow-leo.draws')).toHaveTextContent('Follow back');
  });

  it('block from the profile menu (with confirmation) and unblock', async () => {
    api.addUser({ username: 'spam.bot', displayName: 'Spammy' });
    await bootAs('/u/spam.bot');
    await press(await screen.findByLabelText('More options'));
    await press(await screen.findByTestId('menu-block'));
    await press(await screen.findByTestId('confirm-block'));
    expect(await screen.findByRole('alert', { name: 'Blocked @spam.bot' })).toBeTruthy();
    expect(await screen.findByTestId('unblock')).toBeTruthy();
    expect(await screen.findByText('You blocked this account')).toBeTruthy();
    await press(screen.getByTestId('unblock'));
    expect(await screen.findByRole('alert', { name: 'Unblocked @spam.bot' })).toBeTruthy();
  });

  it('mute, restrict and close friends from the menu', async () => {
    api.addUser({ username: 'pal.ji', displayName: 'Pal' });
    await bootAs('/u/pal.ji');
    for (const [id, msg] of [
      ['menu-close-friend', 'Added to close friends'],
      ['menu-mute', 'Muted @pal.ji'],
      ['menu-restrict', 'Restricted @pal.ji'],
    ] as const) {
      await press(await screen.findByLabelText('More options'));
      await press(await screen.findByTestId(id));
      expect(await screen.findByRole('alert', { name: msg })).toBeTruthy();
    }
    expect(api.flags.close.size + api.flags.mute.size + api.flags.restrict.size).toBe(3);
  });

  it('follow requests: confirm from the list', async () => {
    const fan = api.addUser({ username: 'fan.one', displayName: 'Fan One' });
    const me = api.addUser({ username: 'me.private', displayName: 'Me' });
    me.me.isPrivate = true;
    api.follow(fan.me.id, me.me.id, 'PENDING');
    const s = api.startSession(me.me.id);
    secureStore.set('vybora.refreshToken.v1', s.refresh);
    await renderRouter(appDir, { initialUrl: '/follow-requests' });
    await press(await screen.findByTestId('accept-fan.one'));
    expect(await screen.findByRole('alert', { name: 'Request approved' })).toBeTruthy();
    expect(api.follows.get(`${fan.me.id}->${me.me.id}`)).toBe('ACCEPTED');
  });

  it('own profile shows counts and opens the followers list', async () => {
    const fans = [api.addUser({ username: 'f.one', displayName: 'F One' }), api.addUser({ username: 'f.two', displayName: 'F Two' })];
    const me = await bootAs('/profile');
    for (const f of fans) api.follow(f.me.id, me.me.id);
    await renderRouter(appDir, { initialUrl: '/profile' });
    expect(await screen.findByLabelText('2 Followers')).toBeTruthy();
    await press(screen.getByTestId('stat-followers'));
    expect(await screen.findByTestId('user-f.one')).toBeTruthy();
    expect(screen.getByTestId('user-f.two')).toBeTruthy();
  });
});

describe('edit profile', () => {
  it('validates, saves fields, and uploads a new profile photo', async () => {
    await bootAs('/edit-profile');
    await type('edit-name', 'Nova R.');
    await type('edit-bio', 'Making things that move');
    await type('edit-website', 'nowebsite');
    await press(screen.getByTestId('edit-save'));
    expect(await screen.findByTestId('edit-website-error')).toHaveTextContent(/Enter a valid website/);

    await press(screen.getByTestId('change-avatar'));
    expect(await screen.findByRole('alert', { name: 'Profile photo updated' })).toBeTruthy();
    expect(useAuth.getState().user?.avatarUrl).toMatch(/^http:\/\/cdn\.test\/m\/.+\/lg\.webp$/);

    await type('edit-website', 'nova.dev');
    await press(screen.getByTestId('edit-save'));
    await waitFor(() => expect(useAuth.getState().user).toMatchObject({ displayName: 'Nova R.', bio: 'Making things that move', website: 'https://nova.dev' }));
  });
});

describe('uploadImage', () => {
  beforeEach(() => {
    const me = api.addUser({});
    const s = api.startSession(me.me.id);
    useAuth.setState({ status: 'signedIn', user: me.me, accessToken: s.access });
  });

  it('creates a ticket, PUTs the bytes to storage, completes and waits for READY', async () => {
    const m = await uploadImage('avatar', { uri: 'file:///photos/a.jpg', mimeType: 'image/jpeg' }, { pollMs: 1 });
    expect(m.status).toBe('READY');
    const paths = api.calls.map((c) => `${c.method} ${c.path}`);
    expect(paths).toEqual(expect.arrayContaining(['POST /v1/media/uploads', 'POST /v1/media/' + m.id + '/complete']));
    expect(api.calls.find((c) => c.path === '/v1/media/uploads')!.body).toEqual({ purpose: 'avatar', mimeType: 'image/jpeg', sizeBytes: 2048 });
  });

  it('reports processing failures clearly', async () => {
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      const r = await api.fetchImpl(input, init);
      if (String(input).includes('/complete')) return new Response(JSON.stringify({ id: 'x', status: 'FAILED', urls: {} }), { status: 202 });
      return r;
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchImpl;
    await expect(uploadImage('cover', { uri: 'file:///photos/b.jpg', mimeType: 'image/heic' }, { pollMs: 1 })).rejects.toThrow("We couldn't use that image");
    // HEIC isn't accepted server-side; the client declares JPEG (the picker re-encodes)
    expect(api.calls.find((c) => c.path === '/v1/media/uploads')!.body).toMatchObject({ mimeType: 'image/jpeg' });
  });
});
