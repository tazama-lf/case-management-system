export interface TransactionDetailDataResponse {
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
      currency: string;
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
  amountAndCurrency: Array<
    | {
        originalAmount: number;
        exchangeRate: number;
        convertedAmount: number;
      }
    | {
        senderCharges: never[];
        intermediaryCharges: never[];
        receiverCharges: never[];
      }
    | {
        totalCharges: number;
      }
  >;
  settlementDetails: {
    settlementDate: string;
    reference: string;
    purpose: string;
  };
  links: Array<{
    rel: string;
    href: string;
  }>;
}

export interface TransactionOverviewUIDataResponse {
  transactionOverview: {
    transactionId: string;
    timestamp: string;
    type: string;
    status: string;
  };
  transactionFlow: {
    amount: number;
    currency: string;
    debtor: {
      name: string;
      account: string;
      bank: string;
    };
    creditor: {
      name: string;
      account: string;
      bank: string;
    };
  };
  debtorProfile?: any;
  creditorProfile?: any;
  amountAndCurrency?: any;
  settlementDetails?: any;
  links?: any;
  charges?: any;
  meta?: any;
  transactionMetadata?: any;
}
