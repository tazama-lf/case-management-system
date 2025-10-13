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
  task_id: string;
  case_id: string;
  status: TaskStatusType;
  assigned_user_id?: string;
  name?: string;
  description?: string;
  candidateGroup?: string;
  created_at: string;
  updated_at: string;
  
  assignedUser?: {
    user_id: string;
    username: string;
    role?: string;
  };
  case?: {
    case_id: string;
    case_type?: string;
    priority?: string;
  };
}


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

export interface UnassignTaskData {
  reason: string;
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

export interface SupervisorTasksResponse {
  tasks?: TaskForSupervisor[]; // Backend might not wrap in tasks array
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

  // GET /api/v1/task - Returns raw backend task objects for supervisor view
  async getAllTasks(status?: string): Promise<TaskForSupervisor[]> {
    try {
      const params = new URLSearchParams();
      if (status) {
        params.append('status', status);
      }
      
      const queryString = params.toString();
      const url = `${this.baseUrl}${queryString ? `?${queryString}` : ''}`;
      
      console.log('TaskService: Fetching tasks from:', url);
      
      // Backend returns array of Task objects directly
      const response = await apiClient.get<TaskForSupervisor[]>(url);
      console.log('TaskService: Backend response received:', Array.isArray(response) ? response.length : 'not array', 'items');
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('TaskService: Failed to get all tasks from backend:', error);
      throw this.handleError(error, 'get all tasks');
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

  // PATCH /api/v1/task/:taskId/assign - Assign task to investigator (supervisor action)
  async assignTaskToInvestigator(taskId: string, assignedUserId: string): Promise<TaskForSupervisor> {
    try {
      console.log('TaskService: Assigning task', taskId, 'to user', assignedUserId);
      
      const response = await apiClient.patch<TaskForSupervisor>(
        `${this.baseUrl}/${taskId}/assign`, 
        { assignedUserId }
      );
      
      console.log('TaskService: Task assignment successful:', response);
      return response;
    } catch (error: any) {
      console.error('TaskService: Task assignment failed:', error);
      throw this.handleError(error, 'assign task to investigator');
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

  // PATCH /api/v1/task/:taskId/unassign
  async unassignTask(taskId: string, data: UnassignTaskData): Promise<{ success: boolean; message: string }> {
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

  // PATCH /api/v1/task/:taskId
  async updateTask(taskId: string, data: Partial<Task>): Promise<Task> {
    try {
      const response = await apiClient.patch<Task>(`${this.baseUrl}/${taskId}`, data);
      return this.validateTaskResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'update task');
    }
  }

  // PATCH /api/v1/task/:taskId - Update task for supervisor operations
  async updateTaskForSupervisor(taskId: string, data: { status?: TaskStatusType; assigned_user_id?: string }): Promise<TaskForSupervisor> {
    try {
      const response = await apiClient.patch<TaskForSupervisor>(`${this.baseUrl}/${taskId}`, data);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'update task for supervisor');
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

  // GET /api/v1/task?caseId=:caseId - Get all tasks for a specific case
  async getTasksByCaseId(caseId: string): Promise<TaskForSupervisor[]> {
    try {
      const params = new URLSearchParams();
      params.append('caseId', caseId);
      
      const url = `${this.baseUrl}?${params.toString()}`;
      console.log('TaskService: Fetching tasks for case:', caseId, 'from:', url);
      
      const response = await apiClient.get<TaskForSupervisor[]>(url);
      console.log('TaskService: Tasks for case received:', Array.isArray(response) ? response.length : 'not array', 'items');
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error('TaskService: Failed to get tasks for case:', caseId, error);
      throw this.handleError(error, 'get tasks by case ID');
    }
  }

  // Helper method to complete a task
  async completeTask(taskId: string): Promise<{ success: boolean; message: string }> {
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

  // Helper methods for supervisor task operations
  async startTask(taskId: string): Promise<TaskForSupervisor> {
    return this.updateTaskForSupervisor(taskId, { status: TaskStatus.STATUS_20_IN_PROGRESS });
  }

  async blockTask(taskId: string): Promise<TaskForSupervisor> {
    return this.updateTaskForSupervisor(taskId, { status: TaskStatus.STATUS_21_BLOCKED });
  }

  async completeTaskForSupervisor(taskId: string): Promise<TaskForSupervisor> {
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
