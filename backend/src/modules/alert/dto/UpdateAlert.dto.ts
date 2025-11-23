import { PartialType } from '@nestjs/swagger';
import { CreateAlertDTO } from '.';

export class UpdateAlertDTO extends PartialType(CreateAlertDTO) {}
