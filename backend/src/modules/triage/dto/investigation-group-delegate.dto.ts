export class InvestigationGroupDelegateDto {
  create: (args: { data: { alert_id: number; tenant_id: string } }) => Promise<{ id: number }>;
}
