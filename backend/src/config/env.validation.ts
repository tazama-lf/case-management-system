import { plainToClass } from 'class-transformer';
import { IsEnum, IsString, IsUUID, IsOptional, IsNumberString, validateSync, IsBooleanString, IsIn, IsNotEmpty } from 'class-validator';

enum NodeEnv {
  DEVELOPMENT = 'dev',
  PRODUCTION = 'prod',
  TEST = 'test',
}

enum StartupType {
  NATS = 'nats',
}

enum SameSitePolicy {
  STRICT = 'strict',
  LAX = 'lax',
  NONE = 'none',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsNumberString()
  MAX_CPU!: string;

  @IsNumberString()
  PORT!: string;

  @IsUUID()
  SYSTEM_UUID!: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  TAZAMA_AUTH_URL!: string;

  @IsString()
  @IsOptional()
  AI_MODEL_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  KEYCLOAK_GROUP_NAME?: string;

  @IsString()
  AUTH_PUBLIC_KEY_PATH!: string;

  @IsString()
  CERT_PATH_PUBLIC!: string;

  @IsEnum(StartupType)
  STARTUP_TYPE!: StartupType;

  @IsString()
  SERVER_URL!: string;

  @IsString()
  FUNCTION_NAME!: string;

  @IsString()
  PRODUCER_STREAM!: string;

  @IsString()
  CONSUMER_STREAM!: string;

  @IsOptional()
  @IsString()
  SIDECAR_HOST?: string;

  @IsOptional()
  @IsNumberString()
  CONFIDENCE_THRESHOLD?: string;

  @IsString()
  TRIAGE_TYPE!: string;

  @IsString()
  CLIENT_SYSTEM_INTERDICTION_ENABLED!: string;

  @IsNumberString()
  PRIORITY_FIRST_HALF!: string;

  @IsNumberString()
  PRIORITY_SECOND_HALF!: string;

  @IsNumberString()
  PRIORITY_THIRD_HALF!: string;

  @IsNumberString()
  DEFAULT_SLA_HOURS!: string;

  @IsOptional()
  @IsString()
  FLOWABLE_URL?: string;

  @IsOptional()
  @IsString()
  FLOWABLE_USERNAME?: string;

  @IsOptional()
  @IsString()
  FLOWABLE_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  COUCHDB_URL!: string;

  @IsString()
  @IsNotEmpty()
  COUCHDB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  COUCHDB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  COUCHDB_DATABASE!: string;

  @IsIn(['true', 'false'])
  SESSION_COOKIE_SECURE!: string;

  @IsEnum(SameSitePolicy)
  SESSION_COOKIE_SAMESITE!: SameSitePolicy;

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS!: string;

  @IsOptional()
  @IsString()
  VOILA_URL?: string;

  @IsOptional()
  @IsString()
  GOLD_LAKEHOUSE_API_URL?: string;

  @IsOptional()
  @IsNumberString()
  GOLD_LAKEHOUSE_TIMEOUT?: string;

  @IsString()
  AUDIT_PROVIDER!: string;

  @IsString()
  OPENSEARCH_NODE!: string;

  @IsString()
  OPENSEARCH_USERNAME!: string;

  @IsString()
  OPENSEARCH_PASSWORD!: string;

  @IsBooleanString()
  OPENSEARCH_SSL_REJECT_UNAUTHORIZED!: string;

  @IsBooleanString()
  OPENSEARCH_REFRESH!: string;
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const warnOnSuspiciousCorsConfig = (validatedConfig: EnvironmentVariables): void => {
  const origins = validatedConfig.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (validatedConfig.SESSION_COOKIE_SECURE === 'true' && !origins.some((origin) => origin.startsWith('https://'))) {
    // eslint-disable-next-line no-console -- runs during ConfigModule.forRoot, before the Nest logger exists
    console.warn(
      `[env.validation] SESSION_COOKIE_SECURE=true but no CORS_ALLOWED_ORIGINS entry uses https:// (${validatedConfig.CORS_ALLOWED_ORIGINS}). ` +
        'A Secure cookie is only stored by the browser on an HTTPS origin, so login will appear to succeed and then every subsequent request will 401. ' +
        'This is expected only when a TLS-terminating proxy sits in front of a plaintext internal origin.',
    );
  }

  const port = validatedConfig.PORT;
  const ownOrigin = origins.find((origin) => {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    const hostname = url.hostname.startsWith('[') && url.hostname.endsWith(']') ? url.hostname.slice(1, -1) : url.hostname;
    const effectivePort = url.port || (url.protocol === 'http:' ? '80' : url.protocol === 'https:' ? '443' : '');
    return LOOPBACK_HOSTNAMES.has(hostname) && effectivePort === port;
  });

  if (ownOrigin !== undefined) {
    // eslint-disable-next-line no-console -- runs during ConfigModule.forRoot, before the Nest logger exists
    console.warn(
      `[env.validation] CORS_ALLOWED_ORIGINS entry "${ownOrigin}" matches this backend's own listen port (${port}). ` +
        'CORS_ALLOWED_ORIGINS must list the browser address-bar origin (the frontend), not the backend own origin — ' +
        'the browser never sends an Origin header equal to the server it is calling.',
    );
  }
};

export const validate = (config: Record<string, unknown>): EnvironmentVariables => {
  const validatedConfig = plainToClass(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig);

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (validatedConfig.SESSION_COOKIE_SAMESITE === SameSitePolicy.NONE && validatedConfig.SESSION_COOKIE_SECURE !== 'true') {
    throw new Error('SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true');
  }

  warnOnSuspiciousCorsConfig(validatedConfig);

  return validatedConfig;
};
