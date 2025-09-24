import { IsString, IsObject } from 'class-validator';
import { TransactionDTO } from 'src/nats/dto/Transaction.dto';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';
export class SubmitAlertDto {
  @IsString()
  message: string;

  @IsObject()
  report: Alert;

  @IsObject()
  transaction: TransactionDTO;

  @IsObject()
  networkMap: NetworkMap;

  // New fields for triage workflow
  aml_suspected?: boolean;
  confidence_per?: number;
}
