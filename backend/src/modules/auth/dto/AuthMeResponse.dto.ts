import { ApiProperty } from '@nestjs/swagger';
import { ClaimValidationResult } from '@tazama-lf/auth-lib';
import { IsString } from 'class-validator';

export class AuthMeResponseDto {
  @ApiProperty({ example: '085b7a75-c39d-44f8-868f-6c419f578627' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1', nullable: true })
  @IsString()
  tenantId: string;

  @ApiProperty({ example: 'admin@example.com', nullable: true })
  @IsString()
  email: string;

  @ApiProperty({ example: 'Admin', nullable: true })
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Admin', nullable: true })
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'Admin Admin', nullable: true })
  @IsString()
  fullName?: string;

  @ApiProperty({ example: 'Tenant Name', nullable: true })
  @IsString()
  tenantName: string;

  @ApiProperty({ type: [String], example: ['CMS_SUPERVISOR'] })
  @IsString({ each: true })
  validatedClaims!: ClaimValidationResult;
}
