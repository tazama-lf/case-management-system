import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsNumberString,
  validateSync,
} from 'class-validator';

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
  AUTH_PUBLIC_KEY_PATH: string;

  @IsString()
  CERT_PATH_PUBLIC: string;

  @IsString()
  CERT_PATH_PRIVATE: string;

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
}

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = plainToClass(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig);

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
};
