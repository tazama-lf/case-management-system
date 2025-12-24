export class TransactionDetailDto {
  transactionOverview: TransactionOverviewDto;
  transactionFlow: TransactionFlowDto;
  debtorProfile: DebtorDto;
  creditorProfile: CreditorDto;
  amountAndCurrency: AmountAndCurrencyDto;
  settlementDetails: SettlementDetailsDto;
  visualizationUrl?: string; // For JupyterLab viz
}

export class TransactionOverviewDto {
  transactionId: string;
  transactionType: string;
  timestamp: string;
}

export class TransactionFlowDto {
  debtor: {
    name: string;
    account: AccountDto;
    bank: string;
  };
  amount: {
    amount: number;
  };
  creditor: {
    name: string;
    account: AccountDto;
    bankName: string;
  };
}

export type AmountAndCurrencyDto = [
  {
    originalAmount: number;
    exchangeRate: number;
    convertedAmount: number;
  },
  {
    senderCharges: ChargeDto[];
    intermediaryCharges: ChargeDto[];
    receiverCharges: ChargeDto[];
  },
  {
    totalCharges: number;
  },
];

export class SettlementDetailsDto {
  settlementDate?: string;
  reference?: string;
  purpose?: string;
}

export class DebtorDto {
  name?: string;
  account?: AccountDto;
  bank?: string;
  swiftCode?: string;
  address?: string;
  accountType?: string;
}

export class CreditorDto {
  name?: string;
  account?: AccountDto;
  bank?: string;
  swiftCode?: string;
  address?: string;
  accountType?: string;
}

export class AccountDto {
  iban: string;
  bban?: string;
  currency?: string;
  type?: string;
}

export class ChargeDto {
  amount: number;
  currency: string;
  agent: AgentDto;
}

export class AgentDto {
  memberId: string;
}

export class LinkDto {
  rel: string;
  href: string;
}
