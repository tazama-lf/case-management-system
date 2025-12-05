import { PartialType } from '@nestjs/swagger';
import { CreateNotificationPreferenceDto } from './create-notification-preference.dto';

export class UpdateNotificationPreferenceDto extends PartialType(CreateNotificationPreferenceDto) {}
