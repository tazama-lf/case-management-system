export interface LinkItemData {
  id: string;
  label: string;
  onClick?: () => void;
  pill?: string;
}

export const relatedCasesData: LinkItemData[] = [
  {
    id: 'A-10023',
    label: 'Case A-10023 – Investigation',
  },
  {
    id: 'B-10024',
    label: 'Case B-10024 – Under Investigation',
  },
];

export const relatedAlertsData: LinkItemData[] = [
  {
    id: 'A-001',
    label: 'A-001 – Alert Type 1',
    pill: 'Active',
  },
  {
    id: 'A-002',
    label: 'A-002 – Alert Type 2',
    pill: 'Closed',
  },
];

export const transactionLinksData: LinkItemData[] = [
  {
    id: 'ADPSPKR28392',
    label: 'ADPSPKR28392 – Increased Debtor Activity',
  },
  {
    id: 'ADPSPKR28393',
    label: 'ADPSPKR28393 – Multiple Same-Amount Transfers',
  },
  {
    id: 'ADPSPKR28394',
    label: 'ADPSPKR28394 – Unusual Geographic Pattern',
  },
];

export const messagePayloadLinksData: LinkItemData[] = [
  {
    id: 'pacs.008',
    label: 'View pacs.008 Payload',
  },
  {
    id: 'pacs.002',
    label: 'View pacs.002 Payload',
  },
  {
    id: 'camt.056',
    label: 'View camt.056 Payload',
  },
];
