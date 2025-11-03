import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Priority } from '@prisma/client';

@Injectable()
export class CasePriorityUtil {
  constructor(private readonly configService: ConfigService) {}

  determinePriority(priorityScore: number): Priority {
    const urgencyThresholds = [
      parseFloat(this.configService.get<string>('PRIORITY_FIRST_HALF', '0.33')),
      parseFloat(this.configService.get<string>('PRIORITY_SECOND_HALF', '0.66')),
      parseFloat(this.configService.get<string>('PRIORITY_THIRD_HALF', '1.0')),
    ];

    if (priorityScore >= urgencyThresholds[2]) {
      return Priority.BREACH;
    } else if (priorityScore >= urgencyThresholds[1]) {
      return Priority.CRITICAL;
    } else if (priorityScore >= urgencyThresholds[0]) {
      return Priority.URGENT;
    } else {
      return Priority.NEW;
    }
  }

}