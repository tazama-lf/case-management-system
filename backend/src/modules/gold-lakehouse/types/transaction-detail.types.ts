export interface TransactionDetailDataResponse {
  transactionOverview: {
    pacs8: {
      transactionId: string;
      transactionType: string;
      timestamp: string;
    };
    pacs2: {
      transactionId: string;
      transactionType: string;
      timestamp: string;
    };
  };
  transactionFlow: {
    debtor: {
      name: string;
      account: {
        iban: string;
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
      };
      bankName: string;
    };
  };
  debtorProfile: {
    name: string;
    account: {
      iban: string;
    };
    bank: string;
  };
  creditorProfile: {
    name: string;
    account: {
      iban: string;
    };
    bank: string;
  };
  amountAndCurrency: Array<
    | {
        originalAmount: number;
        exchangeRate: number;
        convertedAmount: number;
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
