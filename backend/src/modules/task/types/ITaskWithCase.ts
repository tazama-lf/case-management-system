import { Task } from '@prisma/client-cms';

export interface TaskWithCase extends Task {
  case: {
    case_id: number;
    priority: string;
    status: string;
    created_at: Date;
  };
}
