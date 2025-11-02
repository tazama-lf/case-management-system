export interface MockTransactionMessage {
  id: string;
  type: string;
  description: string;
  isHighlighted: boolean;
}

export const mockTransactionMessages: MockTransactionMessage[] = [
  {
    id: 'ADPSPKR28392',
    type: 'pacs.008',
    description: 'Increased Debtor Activity',
    isHighlighted: true
  },
  {
    id: 'ADPSPKR28393',
    type: 'pacs.002',
    description: 'Multiple Same-Amount Transfers',
    isHighlighted: false
  },
  {
    id: 'ADPSPKR28394',
    type: 'camt.056',
    description: 'Unusual Geographic Pattern',
    isHighlighted: true
  }
];