export class TransactionDto {
  date: string | null; // creDtTm
  transactionId: string; // endToEndId
  type: string; // txTp
  account: string; // source OR destination (based on role)
  counterparty: string; // the opposite account
  role: 'DEBTOR' | 'CREDITOR';
  amount: number | null; // amt
  currency: string | null; // ccy
}

export class DWHAccountTransactionsResponseDto {
  accountId: string;
  tenantId: string;
  transactions: TransactionDto[];
}

export interface AddressDto {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface AccountDto {
  id: string;
  accountType?: string;
  openedDate?: string;
  balance?: number;
  riskRating?: string;
  role?: string;
  amount?: number;
  currency?: string;
}

export interface CustomerDto {
  customerId: string;
  tenantId: string;
  name?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
}

export interface CustomerProfileByTransactionResponse {
  customerDetails: CustomerDto[];
  address: AddressDto[];
  accountDetails: {
    sender: AccountDto[];
    receiver: AccountDto[];
  };
}

export interface CustomerProfileWithAccountsResponse {
  customerId: string;
  tenantId: string;
  name?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  address?: AddressDto;
  accounts: AccountDto[];
}
