import { validate } from '../src/config/env.validation';

describe('env.validation', () => {
  const createValidConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    NODE_ENV: 'test',
    MAX_CPU: '1',
    PORT: '3090',
    SYSTEM_UUID: 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1',
    DATABASE_URL: 'postgresql://postgres:unused@localhost:5432/tazama_cms',
    TAZAMA_AUTH_URL: 'http://localhost:3020/v1/auth',
    AUTH_PUBLIC_KEY_PATH: 'public.pem',
    CERT_PATH_PUBLIC: 'public.pem',
    STARTUP_TYPE: 'nats',
    SERVER_URL: 'nats://nats:4222',
    FUNCTION_NAME: 'case-management-service',
    PRODUCER_STREAM: 'default',
    CONSUMER_STREAM: 'investigation-service',
    TRIAGE_TYPE: 'MANUAL',
    CLIENT_SYSTEM_INTERDICTION_ENABLED: 'true',
    PRIORITY_FIRST_HALF: '33',
    PRIORITY_SECOND_HALF: '66',
    PRIORITY_THIRD_HALF: '99',
    DEFAULT_SLA_HOURS: '24',
    COUCHDB_URL: 'http://couchdb:5984',
    COUCHDB_USERNAME: 'admin',
    COUCHDB_PASSWORD: 'password',
    COUCHDB_DATABASE: 'cms-evidence',
    SESSION_COOKIE_SECURE: 'true',
    SESSION_COOKIE_SAMESITE: 'strict',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUDIT_PROVIDER: 'opensearch',
    OPENSEARCH_NODE: 'http://localhost:9200',
    OPENSEARCH_USERNAME: 'admin',
    OPENSEARCH_PASSWORD: 'admin',
    OPENSEARCH_SSL_REJECT_UNAUTHORIZED: 'false',
    OPENSEARCH_REFRESH: 'false',
    ...overrides,
  });

  it('accepts a fully populated configuration', () => {
    const config = createValidConfig();

    const result = validate(config);

    expect(result.COUCHDB_URL).toBe('http://couchdb:5984');
    expect(result.COUCHDB_USERNAME).toBe('admin');
    expect(result.COUCHDB_PASSWORD).toBe('password');
    expect(result.COUCHDB_DATABASE).toBe('cms-evidence');
  });

  describe('session cookie cross-field validation', () => {
    it('rejects SameSite=none without Secure=true', () => {
      const config = createValidConfig({
        SESSION_COOKIE_SAMESITE: 'none',
        SESSION_COOKIE_SECURE: 'false',
      });

      expect(() => validate(config)).toThrow('SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true');
    });

    it('accepts SameSite=none with Secure=true', () => {
      const config = createValidConfig({
        SESSION_COOKIE_SAMESITE: 'none',
        SESSION_COOKIE_SECURE: 'true',
      });

      expect(validate(config).SESSION_COOKIE_SAMESITE).toBe('none');
    });

    it('accepts SameSite=lax with Secure=false', () => {
      const config = createValidConfig({
        SESSION_COOKIE_SAMESITE: 'lax',
        SESSION_COOKIE_SECURE: 'false',
      });

      expect(validate(config).SESSION_COOKIE_SAMESITE).toBe('lax');
    });
  });

  describe('CouchDB variables', () => {
    const couchdbKeys = ['COUCHDB_URL', 'COUCHDB_USERNAME', 'COUCHDB_PASSWORD', 'COUCHDB_DATABASE'] as const;

    it.each(couchdbKeys)('rejects an empty %s', (key) => {
      const config = createValidConfig({ [key]: '' });

      expect(() => validate(config)).toThrow(
        new RegExp(`property ${key} has failed the following constraints: isNotEmpty`),
      );
    });

    it.each(couchdbKeys)('rejects a missing %s', (key) => {
      const config = createValidConfig();
      delete config[key];

      expect(() => validate(config)).toThrow(new RegExp(`property ${key} has failed`));
    });

    it('reports every empty CouchDB variable at once', () => {
      const config = createValidConfig({
        COUCHDB_URL: '',
        COUCHDB_USERNAME: '',
        COUCHDB_PASSWORD: '',
        COUCHDB_DATABASE: '',
      });

      expect(() => validate(config)).toThrow(
        /COUCHDB_URL[\s\S]*COUCHDB_USERNAME[\s\S]*COUCHDB_PASSWORD[\s\S]*COUCHDB_DATABASE/,
      );
    });
  });

  describe('SESSION_COOKIE_SECURE', () => {
    it('rejects a missing value', () => {
      const config = createValidConfig();
      delete config.SESSION_COOKIE_SECURE;

      expect(() => validate(config)).toThrow(
        /property SESSION_COOKIE_SECURE has failed the following constraints: isBooleanString/,
      );
    });

    it('rejects an empty value', () => {
      const config = createValidConfig({ SESSION_COOKIE_SECURE: '' });

      expect(() => validate(config)).toThrow(
        /property SESSION_COOKIE_SECURE has failed the following constraints: isBooleanString/,
      );
    });

    it('rejects a malformed value', () => {
      const config = createValidConfig({ SESSION_COOKIE_SECURE: 'yes' });

      expect(() => validate(config)).toThrow(
        /property SESSION_COOKIE_SECURE has failed the following constraints: isBooleanString/,
      );
    });

    it('accepts "false" paired with a non-none SameSite policy', () => {
      const config = createValidConfig({ SESSION_COOKIE_SECURE: 'false', SESSION_COOKIE_SAMESITE: 'lax' });

      expect(validate(config).SESSION_COOKIE_SECURE).toBe('false');
    });
  });

  describe('SESSION_COOKIE_SAMESITE', () => {
    it('rejects a missing value', () => {
      const config = createValidConfig();
      delete config.SESSION_COOKIE_SAMESITE;

      expect(() => validate(config)).toThrow(
        /property SESSION_COOKIE_SAMESITE has failed the following constraints: isEnum/,
      );
    });

    it('rejects an empty value', () => {
      const config = createValidConfig({ SESSION_COOKIE_SAMESITE: '' });

      expect(() => validate(config)).toThrow(
        /property SESSION_COOKIE_SAMESITE has failed the following constraints: isEnum/,
      );
    });

    it('rejects a malformed value', () => {
      const config = createValidConfig({ SESSION_COOKIE_SAMESITE: 'invalid' });

      expect(() => validate(config)).toThrow(
        /property SESSION_COOKIE_SAMESITE has failed the following constraints: isEnum/,
      );
    });

    it.each(['strict', 'lax', 'none'])('accepts "%s"', (value) => {
      const config = createValidConfig({
        SESSION_COOKIE_SAMESITE: value,
        SESSION_COOKIE_SECURE: 'true',
      });

      expect(validate(config).SESSION_COOKIE_SAMESITE).toBe(value);
    });
  });

  describe('CORS_ALLOWED_ORIGINS', () => {
    it('rejects a missing value', () => {
      const config = createValidConfig();
      delete config.CORS_ALLOWED_ORIGINS;

      expect(() => validate(config)).toThrow(/property CORS_ALLOWED_ORIGINS has failed/);
    });

    it('rejects an empty value', () => {
      const config = createValidConfig({ CORS_ALLOWED_ORIGINS: '' });

      expect(() => validate(config)).toThrow(
        /property CORS_ALLOWED_ORIGINS has failed the following constraints: isNotEmpty/,
      );
    });
  });
});
