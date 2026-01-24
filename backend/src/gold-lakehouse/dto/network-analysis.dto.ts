import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionStatsDto {
  @ApiProperty({ description: 'Total number of transactions', example: 20 })
  totalTransactions: number;

  @ApiProperty({ description: 'Total transaction value', example: 156000 })
  totalValue: number;

  @ApiProperty({ description: 'Average transaction value', example: 7800 })
  averageValue: number;

  @ApiProperty({ 
    description: 'Transaction velocity based on frequency', 
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    example: 'MEDIUM'
  })
  velocity: 'HIGH' | 'MEDIUM' | 'LOW';
}


export class ConnectedAccountDto {
  @ApiProperty({ description: 'Connected account identifier', example: 'ACC-2468' })
  accountId: string;

  @ApiProperty({ description: 'Account holder name', example: 'Retail Store' })
  accountHolder: string;

  @ApiProperty({ 
    description: 'Flow direction relative to center account',
    enum: ['Outbound (Payments To)', 'Inbound (Payments From)'],
    example: 'Outbound (Payments To)'
  })
  flowDirection: string;

  @ApiProperty({ 
    description: 'Transaction statistics for this connection',
    type: TransactionStatsDto
  })
  transactionStats: TransactionStatsDto;

  @ApiProperty({ description: 'Whether this account has triggered alerts', example: false })
  hasAlert: boolean;

  @ApiPropertyOptional({ description: 'Alert message if account has alerts', example: 'Alert triggered on this account' })
  alertMessage?: string;

  @ApiPropertyOptional({ description: 'First transaction timestamp' })
  firstTransactionDate?: string;

  @ApiPropertyOptional({ description: 'Last transaction timestamp' })
  lastTransactionDate?: string;
}

export class NetworkSummaryDto {
  @ApiProperty({ description: 'Total number of connected accounts', example: 5 })
  connectedAccounts: number;

  @ApiProperty({ description: 'Number of outbound connections', example: 3 })
  outboundConnections: number;

  @ApiProperty({ description: 'Number of inbound connections', example: 2 })
  inboundConnections: number;

  @ApiProperty({ description: 'Number of accounts with alerts', example: 2 })
  accountsWithAlerts: number;
}

export class CenterAccountDto {
  @ApiProperty({ description: 'Center account identifier', example: 'ACC-1234' })
  accountId: string;

  @ApiProperty({ description: 'Account holder name', example: 'John Smith' })
  accountHolder: string;

  @ApiProperty({ 
    description: 'Network summary statistics',
    type: NetworkSummaryDto
  })
  networkSummary: NetworkSummaryDto;
}

export class NetworkEdgeDto {
  @ApiProperty({ description: 'Edge identifier' })
  id: string;

  @ApiProperty({ description: 'Source account ID' })
  source: string;

  @ApiProperty({ description: 'Target account ID' })
  target: string;

  @ApiProperty({ 
    description: 'Edge type',
    enum: ['inbound', 'outbound'],
    example: 'outbound'
  })
  type: 'inbound' | 'outbound';

  @ApiPropertyOptional({ description: 'Transaction count for this edge' })
  transactionCount?: number;

  @ApiPropertyOptional({ description: 'Total value for this edge' })
  totalValue?: number;
}


export class TransactionNetworkResponseDto {
  @ApiProperty({ 
    description: 'Center account information',
    type: CenterAccountDto
  })
  centerAccount: CenterAccountDto;

  @ApiProperty({ 
    description: 'List of connected accounts',
    type: [ConnectedAccountDto]
  })
  connectedAccounts: ConnectedAccountDto[];

  @ApiProperty({ 
    description: 'Network edges/connections',
    type: [NetworkEdgeDto]
  })
  edges: NetworkEdgeDto[];

  @ApiProperty({ description: 'Time range used for analysis', example: '30d' })
  timeRange: string;

  @ApiProperty({ description: 'Tenant identifier' })
  tenantId: string;

  @ApiProperty({ description: 'Query timestamp' })
  queryTimestamp: string;
}

export class AccountNetworkResponseDto {
  @ApiProperty({ description: 'Center account identifier' })
  accountId: string;

  @ApiProperty({ description: 'Account holder name' })
  accountHolder: string;

  @ApiProperty({ description: 'Linked accounts with transaction data', type: [ConnectedAccountDto] })
  linkedAccounts: ConnectedAccountDto[];

  @ApiProperty({ description: 'Total transactions across network' })
  totalTransactions: number;

  @ApiProperty({ description: 'Total value across network' })
  totalValue: number;

  @ApiProperty({ description: 'Time range used' })
  timeRange: string;

  @ApiProperty({ description: 'Tenant identifier' })
  tenantId: string;
}

export class CounterpartyDto {
  @ApiProperty({ description: 'Counterparty identifier' })
  counterpartyId: string;

  @ApiProperty({ description: 'Counterparty name' })
  counterpartyName: string;

  @ApiProperty({ description: 'Transaction count with this counterparty' })
  transactionCount: number;

  @ApiProperty({ description: 'Total transaction value' })
  transactionValue: number;

  @ApiProperty({ description: 'Average transaction value' })
  averageValue: number;

  @ApiProperty({ description: 'Transaction frequency indicator' })
  frequency: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ description: 'Whether counterparty has alerts' })
  hasAlert: boolean;

  @ApiPropertyOptional({ description: 'Last transaction timestamp' })
  lastTransactionDate?: string;
}


export class CounterpartyNetworkResponseDto {
  @ApiProperty({ description: 'Transaction identifier' })
  transactionId: string;

  @ApiProperty({ description: 'Center account from transaction' })
  centerAccount: string;

  @ApiProperty({ description: 'List of counterparties', type: [CounterpartyDto] })
  counterparties: CounterpartyDto[];

  @ApiProperty({ description: 'Time range used' })
  timeRange: string;

  @ApiProperty({ description: 'Tenant identifier' })
  tenantId: string;
}
