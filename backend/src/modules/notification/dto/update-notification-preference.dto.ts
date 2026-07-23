import { PartialType } from '@nestjs/swagger';
import { CreateNotificationPreferenceDto } from '../../notification-preferences/dto/create-notification-preference.dto';

export class UpdateNotificationPreferenceDto extends PartialType(CreateNotificationPreferenceDto) {}
