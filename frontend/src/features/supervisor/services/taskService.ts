import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';

// Backend TaskStatus enum values (must match Prisma schema)
export const TaskStatus = {
  STATUS_01_UNASSIGNED: 'STATUS_01_UNASSIGNED',
  STATUS_10_ASSIGNED: 'STATUS_10_ASSIGNED', 
  STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
  STATUS_30_COMPLETED: 'STATUS_30_COMPLETED',
  STATUS_21_BLOCKED: 'STATUS_21_BLOCKED'
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
}

export interface AssignTaskData {
  assignedUserId: string;
  assignmentNotes?: string;
}

export interface TaskFilters {
  status?: string;
  assignedUserId?: string;
  caseId?: string;
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

export interface WorkQueueFilters {
  role?: string;
  candidateGroup?: string;
  page?: number;
  limit?: number;
}

export class TaskService {
  private baseUrl = '/api/v1/task';

  // GET /api/v1/task
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

  // GET /api/v1/task/:taskId
  async getTaskDetails(taskId: string): Promise<Task> {
    try {
      const response = await apiClient.get<Task>(`${this.baseUrl}/${taskId}`);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'get task details');
    }
  }

  // PATCH /api/v1/task/:taskId/reassign
  async reassignTask(taskId: string, assignedUserId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.patch<{ success: boolean; message: string }>(
        `${this.baseUrl}/${taskId}/reassign`, 
        { assignedUserId }
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'reassign task');
    }
  }

  // POST /api/v1/task/:taskId/assign
  async assignTask(taskId: string, data: AssignTaskData): Promise<{ success: boolean; message: string }> {
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

  // PATCH /api/v1/task/:taskId
  async updateTask(taskId: string, data: Partial<Task>): Promise<Task> {
    try {
      const response = await apiClient.patch<Task>(`${this.baseUrl}/${taskId}`, data);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'update task');
    }
  }

  // POST /api/v1/task
  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    try {
      const response = await apiClient.post<Task>(this.baseUrl, data);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'create task');
    }
  }

  // GET /api/v1/task/work-queue
  async getWorkQueue(filters?: WorkQueueFilters): Promise<TasksResponse> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });
      }
      
      const response = await apiClient.get<TasksResponse>(`${this.baseUrl}/work-queue?${params}`);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get work queue');
    }
  }

  // Helper method to complete a task
  async completeTask(taskId: string): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: Partial<Task> = {
        status: TaskStatus.STATUS_30_COMPLETED  // Use constant to ensure consistency
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
