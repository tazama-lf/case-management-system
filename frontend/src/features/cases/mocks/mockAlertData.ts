export interface MockAlertData {
  alertId: string;
  dateTime: string;
  riskScore: number;
  entity: string;
  relatedItems: Array<{
    id: string;
    type: 'case';
    title: string;
    description: string;
  }>;
  typologyRules: Array<{
    id: string;
    title: string;
    riskScore: number;
    isExpanded: boolean;
  }>;
}

export const mockAlertData: MockAlertData = {
  alertId: 'A-001',
  dateTime: '2024-01-15 08:30:00',
  riskScore: 85,
  entity: 'John Doe',
  relatedItems: [
    {
      id: '1',
      type: 'case',
      title: 'Case A-10023',
      description: 'Related investigation case'
    }
  ],
  typologyRules: [
    {
      id: '1',
      title: 'Suspicious Transaction Pattern',
      riskScore: 85,
      isExpanded: false
    }
  ]
};