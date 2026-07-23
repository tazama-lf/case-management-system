import { PartialType } from '@nestjs/swagger';
import { CreateAlertDTO } from './CreateAlert.dto';

export class UpdateAlertDTO extends PartialType(CreateAlertDTO) {}
