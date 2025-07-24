export class SubmitAlertDto {
  tenant_id: string;
  priority: 'High' | 'Medium' | 'Low';
  txtp: string;
  source: string;
  message: string;
  alert_data: {
    is_true_positive: boolean;
    aml_suspected: boolean;
    [key: string]: any;
  };
  transaction: object | null;
  network_map: object;
  confidence_per: number;
}
