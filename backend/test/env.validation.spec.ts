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
});
