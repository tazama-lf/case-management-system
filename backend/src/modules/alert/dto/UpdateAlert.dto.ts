import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateAlertDTO } from '.';
import { IsString, MaxLength } from 'class-validator';

export class UpdateAlertDTO extends PartialType(CreateAlertDTO) {}
