import { ConfigError, loadConfig } from './config.js';

const DB = 'postgresql://u:p@localhost:5432/db';

describe('loadConfig', () => {
  it('applies safe defaults in development', () => {
    const c = loadConfig({ DATABASE_URL: DB });
    expect(c.NODE_ENV).toBe('development');
    expect(c.PORT).toBe(4000);
    expect(c.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(c.CORS_ORIGINS).toEqual([]);
    expect(c.TRUST_PROXY).toBe(false);
  });

  it('treats empty secrets as unset (dev default applies; .env.example ships them blank)', () => {
    const c = loadConfig({ DATABASE_URL: DB, JWT_ACCESS_SECRET: '', OTP_PEPPER: '' });
    expect(c.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(() => loadConfig({ DATABASE_URL: DB, NODE_ENV: 'production', JWT_ACCESS_SECRET: '', OTP_PEPPER: '' })).toThrow(/required in production/);
  });

  it('parses comma-separated CORS origins and numbers', () => {
    const c = loadConfig({ DATABASE_URL: DB, CORS_ORIGINS: 'http://a.test, http://b.test', PORT: '8080' });
    expect(c.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(c.PORT).toBe(8080);
  });

  it('requires secrets in production', () => {
    expect(() => loadConfig({ DATABASE_URL: DB, NODE_ENV: 'production' })).toThrow(/JWT_ACCESS_SECRET: required in production/);
  });

  it('rejects short secrets and wildcard CORS in production', () => {
    const env = {
      DATABASE_URL: DB,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'short',
      OTP_PEPPER: 'x'.repeat(20),
      CORS_ORIGINS: '*',
    };
    let err: unknown;
    try {
      loadConfig(env);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConfigError);
    expect(String(err)).toMatch(/JWT_ACCESS_SECRET/);
    expect(String(err)).toMatch(/wildcard/);
  });

  it('accepts a complete production config', () => {
    const c = loadConfig({
      DATABASE_URL: DB,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'p'.repeat(48),
      OTP_PEPPER: 'q'.repeat(24),
      IP_HASH_SECRET: 'r'.repeat(24),
      CORS_ORIGINS: 'https://admin.vybora.app',
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'tok',
      TWILIO_FROM: '+15005550006',
    });
    expect(c.JWT_ACCESS_SECRET).toBe('p'.repeat(48));
  });

  it('refuses console SMS/mail in production and incomplete Twilio config', () => {
    const env = { DATABASE_URL: DB, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'p'.repeat(48), OTP_PEPPER: 'q'.repeat(24), IP_HASH_SECRET: 'r'.repeat(24) };
    expect(() => loadConfig(env)).toThrow(/SMS_PROVIDER: "console"/);
    expect(() => loadConfig({ ...env, SMS_PROVIDER: 'twilio' })).toThrow(/requires TWILIO_ACCOUNT_SID/);
    expect(() => loadConfig({ ...env, SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+1', MAIL_PROVIDER: 'console' })).toThrow(/MAIL_PROVIDER/);
  });

  it('parses Google client ids', () => {
    expect(loadConfig({ DATABASE_URL: DB, GOOGLE_OAUTH_CLIENT_IDS: 'web.apps, ios.apps' }).GOOGLE_OAUTH_CLIENT_IDS).toEqual(['web.apps', 'ios.apps']);
  });

  it('fails fast without DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });
});
