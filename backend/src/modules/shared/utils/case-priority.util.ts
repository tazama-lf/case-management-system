import { Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client-cms';

const HIGH_THRESHOLD = 0.7;
const MEDIUM_THRESHOLD = 0.4;

@Injectable()
export class CasePriorityUtil {
  determinePriority(priorityScore: number): Priority {
    if (priorityScore >= HIGH_THRESHOLD) {
      return Priority.HIGH;
    } else if (priorityScore >= MEDIUM_THRESHOLD) {
      return Priority.MEDIUM;
    } else {
      return Priority.LOW;
    }
  }
}
