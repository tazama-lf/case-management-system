import { plainToClass } from 'class-transformer';
import { IsEnum, IsString, IsUUID, IsOptional, IsNumberString, validateSync } from 'class-validator';

enum NodeEnv {
  DEVELOPMENT = 'dev',
  PRODUCTION = 'prod',
  TEST = 'test',
}

enum StartupType {
  NATS = 'nats',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsNumberString()
  MAX_CPU: string;

  @IsUUID()
  SYSTEM_UUID: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  TAZAMA_AUTH_URL: string;

  @IsString()
  @IsOptional()
  AI_MODEL_ENDPOINT: string;

  @IsOptional()
  @IsString()
  KEYCLOAK_GROUP_NAME?: string;

  @IsString()
  AUTH_PUBLIC_KEY_PATH: string;

  @IsString()
  CERT_PATH_PUBLIC: string;

  @IsEnum(StartupType)
  STARTUP_TYPE: StartupType;

  @IsString()
  SERVER_URL: string;

  @IsString()
  FUNCTION_NAME: string;

  @IsString()
  PRODUCER_STREAM: string;

  @IsString()
  CONSUMER_STREAM: string;

  @IsOptional()
  @IsString()
  SIDECAR_HOST?: string;

  @IsOptional()
  @IsNumberString()
  CONFIDENCE_THRESHOLD?: string;

  @IsString()
  TRIAGE_TYPE: string;

  @IsString()
  CLIENT_SYSTEM_INTERDICTION_ENABLED: string;

  @IsNumberString()
  PRIORITY_FIRST_HALF: string;

  @IsNumberString()
  PRIORITY_SECOND_HALF: string;

  @IsNumberString()
  PRIORITY_THIRD_HALF: string;

  @IsNumberString()
  DEFAULT_SLA_HOURS: string;

  @IsString()
  ALERT_PRIORITY_CRON_SCHEDULE: string;

  @IsOptional()
  @IsString()
  FLOWABLE_URL?: string;

  @IsOptional()
  @IsString()
  FLOWABLE_USERNAME?: string;

  @IsOptional()
  @IsString()
  FLOWABLE_PASSWORD?: string;
}

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = plainToClass(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig);

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
};
