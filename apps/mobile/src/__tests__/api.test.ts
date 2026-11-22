import { ApiRequestError, createApiClient, resolveApiUrl } from '@/lib/api';

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('resolveApiUrl', () => {
  it('keeps real hosts unchanged', () => {
    expect(resolveApiUrl('https://api.vybora.app', '192.168.1.5:8081', 'ios')).toBe('https://api.vybora.app');
  });
  it('swaps localhost for the Metro host IP on devices', () => {
    expect(resolveApiUrl('http://localhost:4000', '192.168.1.5:8081', 'ios')).toBe('http://192.168.1.5:4000');
  });
  it('uses 10.0.2.2 on the Android emulator when no LAN host is known', () => {
    expect(resolveApiUrl('http://localhost:4000', undefined, 'android')).toBe('http://10.0.2.2:4000');
  });
  it('leaves localhost on web', () => {
    expect(resolveApiUrl('http://localhost:4000', '192.168.1.5:8081', 'web')).toBe('http://localhost:4000');
  });
});

describe('createApiClient', () => {
  it('sends JSON, query params and bearer token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    api.setAuth({ getAccessToken: () => 'tok', refresh: async () => false, onSessionEnded: () => {} });
    await expect(api.post('/v1/things', { a: 1 }, { query: { limit: 5, skip: undefined } })).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api.test/v1/things?limit=5');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ authorization: 'Bearer tok', 'content-type': 'application/json' });
  });

  it('turns ApiError envelopes into ApiRequestError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(409, { statusCode: 409, code: 'USERNAME_TAKEN', message: 'Taken', requestId: 'r-1' }),
    );
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiRequestError;
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 409, code: 'USERNAME_TAKEN', message: 'Taken', requestId: 'r-1' });
    expect(err.isNetwork).toBe(false);
  });

  it('handles non-JSON error bodies', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'x-request-id': 'r-2' } }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    await expect(api.get('/x')).rejects.toMatchObject({ status: 502, code: 'HTTP_502', requestId: 'r-2' });
  });

  it('maps connectivity failures to NETWORK_ERROR', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    const err = (await api.get('/x').catch((e: unknown) => e)) as ApiRequestError;
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(err.isNetwork).toBe(true);
  });

  it('times out slow requests', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(api.get('/slow', { timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('auth handling', () => {
  const err = (status: number, code: string) => jsonResponse(status, { statusCode: status, code, message: code });

  it('refreshes once on AUTH_TOKEN_EXPIRED and replays the request with the new token', async () => {
    let token = 'old';
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(err(401, 'AUTH_TOKEN_EXPIRED'))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const refresh = jest.fn(async () => {
      token = 'new';
      return true;
    });
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    api.setAuth({ getAccessToken: () => token, refresh, onSessionEnded: jest.fn() });
    await expect(api.get('/v1/me')).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer old');
    expect(fetchImpl.mock.calls[1][1].headers.authorization).toBe('Bearer new');
  });

  it('ends the session on revoked/invalid tokens without refreshing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(err(401, 'AUTH_SESSION_REVOKED'));
    const refresh = jest.fn();
    const onSessionEnded = jest.fn();
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    api.setAuth({ getAccessToken: () => 't', refresh, onSessionEnded });
    await expect(api.get('/v1/me')).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionEnded).toHaveBeenCalledWith('AUTH_SESSION_REVOKED');
  });

  it('anonymous requests never send a token or trigger refresh', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(err(401, 'AUTH_INVALID_CREDENTIALS'));
    const refresh = jest.fn();
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    api.setAuth({ getAccessToken: () => 't', refresh, onSessionEnded: jest.fn() });
    await expect(api.post('/v1/auth/login', {}, { anonymous: true })).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('exposes field errors from validation and conflict responses', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'x', details: { issues: [{ path: 'email', message: 'Enter a valid email address.' }] } }))
      .mockResolvedValueOnce(jsonResponse(409, { statusCode: 409, code: 'USERNAME_TAKEN', message: 'That username is taken.', details: { field: 'username' } }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    const a = (await api.get('/x').catch((e: unknown) => e)) as ApiRequestError;
    expect(a.fieldErrors).toEqual({ email: 'Enter a valid email address.' });
    const b = (await api.get('/x').catch((e: unknown) => e)) as ApiRequestError;
    expect(b.fieldErrors).toEqual({ username: 'That username is taken.' });
  });
});
