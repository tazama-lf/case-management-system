import apiClient from '../../../shared/services/apiClient';

export interface CustomerDetails {
  customerId: string;
  tenantId: string;
  name?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AccountDetail {
  id: string;
  accountType?: string;
  openedDate?: string;
  balance?: number;
  riskRating?: string;
  amount?: number;
  currency?: string;
}

export interface CustomerProfileResponse {
  customerDetails: CustomerDetails[];
  address: Address[];
  accountDetails: {
    sender: AccountDetail[];
    receiver: AccountDetail[];
  };
}

export const dwhService = {
  async getCustomerProfile(
    transactionId: string,
  ): Promise<CustomerProfileResponse> {
    console.log('dwhService.getCustomerProfile called with:', transactionId);
    try {
      const response = await apiClient.get<CustomerProfileResponse>(
        `/api/v1/dwh/customer/profile/${transactionId}`,
      );
      console.log('dwhService API response:', response);
      console.log('dwhService API response.data:', response.data);

      // Check if data is at response level or response.data level
      const data = response.data || response;
      console.log('dwhService returning data:', data);
      return data as CustomerProfileResponse;
    } catch (error) {
      console.error('dwhService API error:', error);
      throw error;
    }
  },
};

export default dwhService;
