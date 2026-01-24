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
  @ApiProperty({ 
    description: 'Counterparty unique identifier', 
    example: 'dbtr_590333b8f3e040a0af6678f0390f8286' 
  })
  counterpartyId: string;

  @ApiProperty({ 
    description: 'Counterparty name (person or organization)', 
    example: 'Global Trading Corp' 
  })
  counterpartyName: string;

  @ApiProperty({ 
    description: 'Relationship degree from center (1st or 2nd degree connection)', 
    example: 1,
    enum: [1, 2]
  })
  degree: number;

  @ApiProperty({ 
    description: 'Transaction count with this counterparty', 
    example: 145 
  })
  transactionCount: number;

  @ApiProperty({ 
    description: 'Total transaction value', 
    example: 1234000.50 
  })
  totalValue: number;

  @ApiProperty({ 
    description: 'Average transaction value', 
    example: 8510.35 
  })
  averageValue: number;

  @ApiProperty({ 
    description: 'Transaction frequency indicator',
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    example: 'HIGH'
  })
  frequency: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ 
    description: 'Whether counterparty has triggered alerts', 
    example: true 
  })
  hasAlert: boolean;

  @ApiProperty({ 
    description: 'Whether counterparty is under investigation', 
    example: false 
  })
  isInvestigated: boolean;

  @ApiPropertyOptional({ 
    description: 'First transaction timestamp', 
    example: '2026-01-13T03:35:16.676Z' 
  })
  firstTransactionDate?: string;

  @ApiPropertyOptional({ 
    description: 'Last transaction timestamp', 
    example: '2026-01-23T10:20:30.123Z' 
  })
  lastTransactionDate?: string;
}

export class CounterpartyNetworkSummaryDto {
  @ApiProperty({ 
    description: 'Total number of counterparties in network', 
    example: 8 
  })
  totalCounterparties: number;

  @ApiProperty({ 
    description: 'Number of 1st degree connections', 
    example: 5 
  })
  firstDegreeConnections: number;

  @ApiProperty({ 
    description: 'Number of 2nd degree connections', 
    example: 3 
  })
  secondDegreeConnections: number;

  @ApiProperty({ 
    description: 'Number of counterparties with alerts', 
    example: 2 
  })
  counterpartiesWithAlerts: number;

  @ApiProperty({ 
    description: 'Number of counterparties under investigation', 
    example: 1 
  })
  counterpartiesUnderInvestigation: number;

  @ApiProperty({ 
    description: 'Total transaction value across network', 
    example: 5678000.75 
  })
  totalNetworkValue: number;
}

export class CenterCounterpartyDto {
  @ApiProperty({ 
    description: 'Center counterparty identifier', 
    example: 'dbtr_590333b8f3e040a0af6678f0390f8286' 
  })
  counterpartyId: string;

  @ApiProperty({ 
    description: 'Center counterparty name', 
    example: 'Sarah Grant' 
  })
  counterpartyName: string;

  @ApiProperty({ 
    description: 'Network summary statistics',
    type: CounterpartyNetworkSummaryDto
  })
  networkSummary: CounterpartyNetworkSummaryDto;
}

export class CounterpartyNetworkEdgeDto {
  @ApiProperty({ 
    description: 'Edge unique identifier', 
    example: 'edge-0' 
  })
  id: string;

  @ApiProperty({ 
    description: 'Source counterparty ID', 
    example: 'dbtr_590333b8f3e040a0af6678f0390f8286' 
  })
  source: string;

  @ApiProperty({ 
    description: 'Target counterparty ID', 
    example: 'cdtr_bbdc270b8eff4e4991fb2a5288d0334d' 
  })
  target: string;

  @ApiProperty({ 
    description: 'Transaction count for this relationship', 
    example: 45 
  })
  transactionCount: number;

  @ApiProperty({ 
    description: 'Total value for this relationship', 
    example: 567000.00 
  })
  totalValue: number;

  @ApiProperty({ 
    description: 'Whether this relationship has alerts', 
    example: false 
  })
  hasAlert: boolean;

  @ApiProperty({ 
    description: 'Whether this relationship is under investigation', 
    example: false 
  })
  isInvestigated: boolean;
}


export class CounterpartyNetworkResponseDto {
  @ApiProperty({ 
    description: 'Transaction identifier that initiated the analysis', 
    example: 'TXN-123456' 
  })
  transactionId: string;

  @ApiProperty({ 
    description: 'Center counterparty information with network summary',
    type: CenterCounterpartyDto
  })
  centerCounterparty: CenterCounterpartyDto;

  @ApiProperty({ 
    description: 'List of connected counterparties with relationship details',
    type: [CounterpartyDto],
    isArray: true
  })
  counterparties: CounterpartyDto[];

  @ApiProperty({ 
    description: 'Network edges representing relationships between counterparties',
    type: [CounterpartyNetworkEdgeDto],
    isArray: true
  })
  edges: CounterpartyNetworkEdgeDto[];

  @ApiProperty({ 
    description: 'Time range used for analysis', 
    example: '30d',
    enum: ['7d', '30d', '90d', '1y', 'all']
  })
  timeRange: string;

  @ApiProperty({ 
    description: 'Tenant identifier', 
    example: 'DEFAULT' 
  })
  tenantId: string;

  @ApiProperty({ 
    description: 'Timestamp when query was executed', 
    example: '2026-01-24T10:30:45.123Z' 
  })
  queryTimestamp: string;
}

