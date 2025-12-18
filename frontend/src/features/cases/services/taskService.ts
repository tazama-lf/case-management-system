import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';


export const TaskStatus = {
  STATUS_01_UNASSIGNED: 'STATUS_01_UNASSIGNED',
  STATUS_10_ASSIGNED: 'STATUS_10_ASSIGNED',
  STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
  STATUS_30_COMPLETED: 'STATUS_30_COMPLETED',
  STATUS_21_BLOCKED: 'STATUS_21_BLOCKED'
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

export interface TaskForSupervisor {
  task_id: number;
  case_id: number;
  status: TaskStatusType;
  assigned_user_id?: string;
  name?: string;
  description?: string;
  candidateGroup?: string;
  investigationNotes?: string;
  created_at: string;
  updated_at: string;

  assignedUser?: {
    user_id: string;
    username: string;
    role?: string;
  };
  case?: {
    case_id: number;
    case_type?: string;
    priority?: string;
  };
}


export interface Task {
  id: number;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  caseId?: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  investigationNotes?: string;
}

export interface AssignTaskData {
  assignedUserId: string;
  assignmentNotes?: string;
}

export interface UnassignTaskData {
  reason: string;
}

export interface CloseTaskData {
  notes: string;
}

export interface TaskFilters {
  status?: string;
  assignedUserId?: string;
  caseId?: number;
  priority?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TasksResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SupervisorTasksResponse {
  tasks?: TaskForSupervisor[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface WorkQueueFilters {
  role?: string;
  candidateGroup?: string;
  page?: number;
  limit?: number;
}

export interface WorkQueueResponse {
  tasks: TaskForSupervisor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TaskService {
  private baseUrl = '/api/v1/task';

  async getTasks(filters?: TaskFilters): Promise<TasksResponse> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });
      }

      const response = await apiClient.get<TasksResponse>(`${this.baseUrl}?${params}`);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get tasks');
    }
  }

  async getAllTasks(status?: string): Promise<TaskForSupervisor[]> {
    try {
      const params = new URLSearchParams();
      if (status) {
        params.append('status', status);
      }

      const queryString = params.toString();
      const url = `${this.baseUrl}${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<TaskForSupervisor[]>(url);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('TaskService: Failed to get all tasks from backend:', error);
      throw this.handleError(error, 'get all tasks');
    }
  }

  async getTaskDetails(taskId: number): Promise<Task> {
    try {
      const response = await apiClient.get<Task>(`${this.baseUrl}/${taskId}`);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'get task details');
    }
  }

  async assignTaskToInvestigator(taskId: number, assignedUserId: string, note?: string): Promise<TaskForSupervisor> {
    try {
      const response = await apiClient.patch<TaskForSupervisor>(
        `${this.baseUrl}/${taskId}/assign`,
        {
          assignedUserId,
          note
        }
      );

      return response;
    } catch (error: any) {
      console.error('TaskService: Task assignment failed:', error);
      throw this.handleError(error, 'assign task to investigator');
    }
  }

  async reassignTask(taskId: number, assignedUserId: string, note: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.patch<{ success: boolean; message: string }>(
        `${this.baseUrl}/${taskId}/reassign`,
        {
          assignedUserId,
          note
        }
      );

      return response;
    } catch (error: any) {
      console.error('TaskService: Task reassignment failed:', error);
      throw this.handleError(error, 'reassign task');
    }
  }

  async assignTask(taskId: number, data: AssignTaskData): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `${this.baseUrl}/${taskId}/assign`,
        data
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'assign task');
    }
  }

  async unassignTask(taskId: number, data: UnassignTaskData): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.patch<{ success: boolean; message: string }>(
        `${this.baseUrl}/${taskId}/unassign`,
        data
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'unassign task');
    }
  }

  async updateTask(taskId: number, data: Partial<Task>): Promise<Task> {
    try {
      const response = await apiClient.patch<Task>(`${this.baseUrl}/${taskId}`, data);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'update task');
    }
  }

  async updateTaskForSupervisor(
    taskId: number,
    data: {
      status?: TaskStatusType;
      assigned_user_id?: string;
      name?: string;
      description?: string;
      investigationNotes?: string;
    },
  ): Promise<TaskForSupervisor> {
    try {
      const response = await apiClient.patch<TaskForSupervisor>(`${this.baseUrl}/${taskId}`, data);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'update task for supervisor');
    }
  }

  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    try {
      const response = await apiClient.post<Task>(this.baseUrl, data);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'create task');
    }
  }

  async getWorkQueue(filters?: WorkQueueFilters): Promise<WorkQueueResponse> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });
      }

      const response = await apiClient.get<WorkQueueResponse>(`${this.baseUrl}/work-queue?${params}`);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get work queue');
    }
  }

  async getTasksByCaseId(caseId: number): Promise<TaskForSupervisor[]> {
    try {
      const url = `${this.baseUrl}/case/${caseId}`;

      const response = await apiClient.get<TaskForSupervisor[]>(url);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('TaskService: Failed to get tasks for case:', caseId, error);
      throw this.handleError(error, 'get tasks by case ID');
    }
  }

  async getInvestigationTaskForCase(caseId: number): Promise<TaskForSupervisor | null> {
    try {
      const tasks = await this.getTasksByCaseId(caseId);
      // Find investigation task
      const investigationTask = tasks.find(
        (t) => t.name && t.name.toLowerCase().includes('investigation')
      );
      return investigationTask || null;
    } catch (error: any) {
      console.error(
        'TaskService: Failed to get investigation task for case:',
        caseId,
        error,
      );
      throw this.handleError(error, 'get investigation task for case');
    }
  }

  async completeTask(
    taskId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: Partial<Task> = {
        status: TaskStatus.STATUS_30_COMPLETED
      };

      await this.updateTask(taskId, updateData);

      return {
        success: true,
        message: 'Task completed successfully'
      };
    } catch (error: any) {
      throw this.handleError(error, 'complete task');
    }
  }

  async closeTask(taskId: number, _data: CloseTaskData): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: Partial<Task> = {
        status: TaskStatus.STATUS_30_COMPLETED
      };

      await this.updateTask(taskId, updateData);

      return {
        success: true,
        message: 'Task closed successfully'
      };
    } catch (error: any) {
      throw this.handleError(error, 'close task');
    }
  }

  async startTask(taskId: number): Promise<TaskForSupervisor> {
    return this.updateTaskForSupervisor(taskId, { status: TaskStatus.STATUS_20_IN_PROGRESS });
  }

  async blockTask(taskId: number): Promise<TaskForSupervisor> {
    return this.updateTaskForSupervisor(taskId, { status: TaskStatus.STATUS_21_BLOCKED });
  }

  async completeTaskForSupervisor(taskId: number): Promise<TaskForSupervisor> {
    return this.updateTaskForSupervisor(taskId, { status: TaskStatus.STATUS_30_COMPLETED });
  }

  private validateTaskResponse(data: unknown): Task {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid task data received');
    }

    const task = data as Task;
    if (!task.id) {
      throw new Error('Task ID is missing from response');
    }

    return task;
  }

  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      return new Error(apiError.message || `Failed to ${operation}`);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const taskService = new TaskService();
