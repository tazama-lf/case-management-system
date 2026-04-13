import type { Condition } from '@tazama-lf/frms-coe-lib';

export interface ConditionsTableDataResponse {
  tableName: string;
  totalRows: number;
  data: Condition[];
  note: string;
}
