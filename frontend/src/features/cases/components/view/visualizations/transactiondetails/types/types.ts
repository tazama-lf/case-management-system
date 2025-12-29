export interface TransactionDetailsDto {
  transactionOverview: {
    transactionId: string;
    transactionType: string;
    timestamp: string;
  };
  transactionFlow: {
    debtor: {
      name: string;
      account: {
        iban: string;
        type: string;
      };
      bank: string;
    };
    amount: {
      amount: number;
      currency?: string;
    };
    creditor: {
      name: string;
      account: {
        iban: string;
        type: string;
      };
      bankName: string;
    };
  };
  debtorProfile: {
    name: string;
    account: {
      iban: string;
      type: string;
    };
    bank: string;
    swiftCode: string;
    address: string;
    accountType: string;
  };
  creditorProfile: {
    name: string;
    account: {
      iban: string;
      type: string;
    };
    bank: string;
    swiftCode: string;
    address: string;
    accountType: string;
  };
  amountAndCurrency: Array<{
    originalAmount?: number;
    exchangeRate?: number;
    convertedAmount?: number;
    senderCharges?: Array<{
      amount: number;
      currency: string;
      agent: {
        memberId: string;
      };
    }>;
    intermediaryCharges?: Array<{
      amount: number;
      currency: string;
      agent: {
        memberId: string;
      };
    }>;
    receiverCharges?: Array<{
      amount: number;
      currency: string;
      agent: {
        memberId: string;
      };
    }>;
    totalCharges?: number;
  }>;
  settlementDetails: {
    settlementDate?: string;
    reference?: string;
    purpose?: string;
  };
  links?: Array<{
    rel: string;
    href: string;
  }>;
  visualizationUrl?: string;
}
