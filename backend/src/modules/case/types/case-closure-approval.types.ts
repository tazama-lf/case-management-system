import type { TaskStatus } from '@prisma/client-cms';

export interface ApprovalTaskDTO {
  assigned_user_id: string | null;
  case_id?: number | undefined;
  created_at?: Date | undefined;
  name: string | null;
  status: TaskStatus;
  task_id: number;
}
