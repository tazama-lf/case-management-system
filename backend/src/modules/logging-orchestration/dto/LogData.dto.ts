import { IsString } from 'class-validator';
import { Outcome } from 'src/utils/types/outcome';

export class LogDataDTO {
  @IsString()
  userId: string;

  @IsString()
  actionPerformed: string;

  @IsString()
  entityName: string;

  @IsString()
  operation: string;

  @IsString()
  outcome: Outcome;
}
