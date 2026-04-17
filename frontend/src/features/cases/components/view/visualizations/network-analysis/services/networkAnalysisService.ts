import apiClient from '@/shared/services/apiClient';

export interface NetworkNode {
  id: string;
  label?: string;
  type: 'account' | 'counterparty';
  status?: 'normal' | 'alert' | 'flagged' | 'investigation';
  isCenter?: boolean;
  txCount?: number;
  totalAmount?: number;
  flags?: {
    alerted?: boolean;
  };
  sublabel?: string;
}

export interface NetworkEdge {
  source?: string;
  from?: string;
  target?: string;
  to?: string;
  txCount?: number;
  totalAmount?: number;
  type?: 'inbound' | 'outbound';
}

export interface AccountNetworkResponse {
  network: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
  accountDetails: {
    accountId: string;
    accountHolder?: string;
    transactions?: number;
    totalValue?: number;
    velocity?: string;
    relationship?: string;
    flags?: {
      alerted?: boolean;
    };
  };
  meta?: Record<string, unknown>;
}

class NetworkAnalysisService {
  private baseUrl = '/api/v1/lakehouse/network-analysis';

  async getAccountNetwork(
    accountId: string,
    tenantId: string = 'DEFAULT',
  ): Promise<AccountNetworkResponse> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    try {
      const response = await apiClient.get<AccountNetworkResponse>(
        `${this.baseUrl}/account/${accountId}?tenantId=${tenantId}`,
      );
      return response;
    } catch (error) {
      console.error(`Failed to fetch network data for account ${accountId}:`, error);
      throw error;
    }
  }
}

export default new NetworkAnalysisService();
