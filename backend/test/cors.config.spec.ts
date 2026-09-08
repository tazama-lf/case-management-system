import { parseAllowedOrigins } from '../src/config/cors.config';

describe('parseAllowedOrigins', () => {
  it('parses a single origin', () => {
    expect(parseAllowedOrigins('http://localhost:5175')).toEqual(['http://localhost:5175']);
  });

  it('parses and trims a comma-separated list', () => {
    expect(parseAllowedOrigins('http://localhost:5175, https://app.example.com')).toEqual([
      'http://localhost:5175',
      'https://app.example.com',
    ]);
  });

  it('ignores empty entries from trailing or doubled commas', () => {
    expect(parseAllowedOrigins('http://localhost:5175,,')).toEqual(['http://localhost:5175']);
  });

  it('accepts an https origin without a port', () => {
    expect(parseAllowedOrigins('https://app.example.com')).toEqual(['https://app.example.com']);
  });

  it.each(['', '   ', ',', ' , '])('throws when no usable origin is present (%p)', (raw) => {
    expect(() => parseAllowedOrigins(raw)).toThrow('CORS_ALLOWED_ORIGINS must list at least one origin');
  });

  it.each([
    'not-an-origin',
    'ftp://example.com',
    'https://example.com/',
    'https://example.com/path',
    'https://example.com?q=1',
    'https://example.com#frag',
    'https://user:pass@example.com',
  ])('throws for a malformed or non-exact origin (%p)', (raw) => {
    expect(() => parseAllowedOrigins(raw)).toThrow(/CORS_ALLOWED_ORIGINS entry/);
  });

  it('rejects the whole list when any entry is invalid', () => {
    expect(() => parseAllowedOrigins('http://localhost:5175,https://example.com/')).toThrow(/CORS_ALLOWED_ORIGINS entry/);
  });
});
