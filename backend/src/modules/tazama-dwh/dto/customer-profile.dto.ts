import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';

export class AddressDto {
  @ApiProperty({ description: 'Street address', required: false })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'State or Province', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Postal code', required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;
}

export class AccountDetailsDto {
  @ApiProperty({ description: 'Account ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Account type', example: 'personal', enum: ['personal', 'business', 'savings'] })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiProperty({ description: 'Account opened date', example: '2020-01-10' })
  @IsOptional()
  @IsString()
  openedDate?: string;

  @ApiProperty({ description: 'Current balance', example: 12345.67 })
  @IsOptional()
  balance?: number;

  @ApiProperty({ description: 'Risk rating', example: 'Medium', enum: ['Low', 'Medium', 'High'] })
  @IsOptional()
  @IsString()
  riskRating?: string;
}

export class TransactionAccountDetailsDto extends AccountDetailsDto {
  @ApiProperty({ description: 'Transaction amount', example: 1500.5 })
  @IsOptional()
  amount?: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CustomerDetailsDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Customer name', example: 'John Smith' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Date of birth', example: '1985-05-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Email address', example: 'j.smith@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Phone number', example: '+1 (555) 123-4567' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CustomerProfileResponseDto {
  @ApiProperty({ description: 'Customer details', type: [CustomerDetailsDto] })
  @IsArray()
  customerDetails: CustomerDetailsDto[];

  @ApiProperty({ description: 'Customer address', type: [AddressDto] })
  @IsArray()
  address: AddressDto[];

  @ApiProperty({ description: 'Account details with sender and receiver', type: Object })
  @IsObject()
  accountDetails: {
    sender: TransactionAccountDetailsDto[];
    receiver: TransactionAccountDetailsDto[];
  };
}
