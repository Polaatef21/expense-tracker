import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppConfig } from '../src/config/env.js';

const VALID_SECRET = 'x'.repeat(40);

beforeEach(() => {
  // A valid baseline; individual tests override one variable at a time
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('PORT', '5000');
  vi.stubEnv('CLIENT_ORIGIN', 'http://localhost:5173');
  vi.stubEnv('JWT_SECRET', VALID_SECRET);
  vi.stubEnv('JWT_EXPIRES_IN', '1d');
  vi.stubEnv('BCRYPT_SALT_ROUNDS', '12');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function withEnv(vars) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
}

describe('getAppConfig', () => {
  it('parses valid settings, including a comma-separated origin list', () => {
    withEnv({ NODE_ENV: 'production', PORT: '8080', CLIENT_ORIGIN: 'http://localhost:5173, https://app.example.com' });
    expect(getAppConfig()).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      clientOrigins: ['http://localhost:5173', 'https://app.example.com'],
      auth: { jwtSecret: VALID_SECRET, jwtExpiresIn: '1d', saltRounds: 12 },
    });
  });

  it('applies defaults for PORT, NODE_ENV, JWT_EXPIRES_IN and BCRYPT_SALT_ROUNDS', () => {
    withEnv({ NODE_ENV: '', PORT: '', JWT_EXPIRES_IN: '', BCRYPT_SALT_ROUNDS: '' });
    expect(getAppConfig()).toMatchObject({
      nodeEnv: 'development',
      port: 5000,
      auth: { jwtExpiresIn: '1d', saltRounds: 12 },
    });
  });

  it('treats a unit-less JWT_EXPIRES_IN as seconds (not milliseconds)', () => {
    withEnv({ JWT_EXPIRES_IN: '3600' });
    expect(getAppConfig().auth.jwtExpiresIn).toBe(3600);
  });

  it.each(['abc', '0', '70000', '50.5'])('rejects PORT=%s', (port) => {
    withEnv({ PORT: port });
    expect(() => getAppConfig()).toThrow(/PORT must be an integer/);
  });

  it('rejects an unknown NODE_ENV', () => {
    withEnv({ NODE_ENV: 'staging' });
    expect(() => getAppConfig()).toThrow(/NODE_ENV must be one of/);
  });

  it.each([
    ['empty', '', /at least one allowed/],
    ['not a URL', 'localhost:5173x', /invalid URL|bare origin/],
    ['with a path', 'http://localhost:5173/app', /bare origin/],
    ['with a trailing slash', 'http://localhost:5173/', /bare origin/],
  ])('rejects a CLIENT_ORIGIN that is %s', (_label, origin, message) => {
    withEnv({ CLIENT_ORIGIN: origin });
    expect(() => getAppConfig()).toThrow(message);
  });

  it.each([['missing', ''], ['too short', 'short-secret']])('rejects a %s JWT_SECRET', (_label, secret) => {
    withEnv({ JWT_SECRET: secret });
    expect(() => getAppConfig()).toThrow(/JWT_SECRET must be a random string of at least 32 characters/);
  });

  it.each(['1 day', '1w', '-5'])('rejects JWT_EXPIRES_IN=%s', (value) => {
    withEnv({ JWT_EXPIRES_IN: value });
    expect(() => getAppConfig()).toThrow(/JWT_EXPIRES_IN/);
  });

  it.each(['4', '9', '16', 'abc'])('rejects BCRYPT_SALT_ROUNDS=%s', (value) => {
    withEnv({ BCRYPT_SALT_ROUNDS: value });
    expect(() => getAppConfig()).toThrow(/BCRYPT_SALT_ROUNDS must be an integer between 10 and 15/);
  });
});
