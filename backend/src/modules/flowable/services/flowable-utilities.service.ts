import { Injectable } from '@nestjs/common';
import { FlowableDefaults, CandidateGroups, FlowableApiEndpoints } from '../../../constants/flowable-api.constants';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';
import { FlowableClientFactory } from './flowable-client.factory';

/**
 * Unified utility service for Flowable operations
 * Provides event deduplication, task finding/matching, and variable retrieval utilities
 */
@Injectable()
export class FlowableUtilitiesService {
  private readonly recentlyProcessedEvents = new Map<string, number>();
  private readonly EVENT_DEBOUNCE_MS = FlowableDefaults.EVENT_DEBOUNCE_MS;
  private readonly MAX_CACHE_SIZE = FlowableDefaults.MAX_CACHE_SIZE;
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
    // private readonly taskBridgeService: TaskBridgeService
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  // ==================== Event Deduplication ====================

  /**
   * Check if an event is a duplicate within the debounce window
   * @param eventKey Unique identifier for the event
   * @returns true if duplicate, false if should be processed
   */
  isDuplicate(eventKey: string): boolean {
    const now = Date.now();
    const lastProcessed = this.recentlyProcessedEvents.get(eventKey);

    if (lastProcessed && now - lastProcessed < this.EVENT_DEBOUNCE_MS) {
      return true;
    }

    this.recentlyProcessedEvents.set(eventKey, now);
    this.cleanupOldEntries(now);
    return false;
  }

  /**
   * Remove old entries from cache to prevent memory leak
   */
  private cleanupOldEntries(now: number): void {
    if (this.recentlyProcessedEvents.size > this.MAX_CACHE_SIZE) {
      const cutoff = now - this.EVENT_DEBOUNCE_MS * 2;
      for (const [key, timestamp] of this.recentlyProcessedEvents.entries()) {
        if (timestamp < cutoff) {
          this.recentlyProcessedEvents.delete(key);
        }
      }
    }
  }

  /**
   * Clear all cached events (useful for testing)
   */
  clearEventCache(): void {
    this.recentlyProcessedEvents.clear();
  }

  /**
   * Get current cache size (useful for monitoring)
   */
  getEventCacheSize(): number {
    return this.recentlyProcessedEvents.size;
  }

  // ==================== Task Finding & Matching ====================

  /**
   * Find a Flowable task by PostgreSQL task ID
   * @param flowableTasks Array of Flowable tasks to search
   * @param postgresTaskId PostgreSQL task ID to find
   * @param getTaskVariablesFn Function to get task variables
   * @returns Matching Flowable task or null
   */
  async findByPostgresTaskId(
    flowableTasks: any[],
    postgresTaskId: string,
    getTaskVariablesFn: (taskId: string) => Promise<Record<string, string>>,
  ): Promise<any | null> {
    for (const task of flowableTasks) {
      const vars = await getTaskVariablesFn(task.id);
      if (vars.postgres_task_id === postgresTaskId) {
        return task;
      }
    }
    return null;
  }

  /**
   * Find an unmapped BPMN task that matches criteria
   * Used to sync newly created BPMN tasks with PostgreSQL
   * @param flowableTasks Array of Flowable tasks to search
   * @param taskName Task name to match
   * @param getTaskVariablesFn Function to get task variables
   * @param candidateGroup Optional candidate group to match
   * @returns Matching unmapped task or null
   */
  async findUnmappedBpmnTask(
    flowableTasks: any[],
    taskName: string,
    getTaskVariablesFn: (taskId: string) => Promise<Record<string, string>>,
    candidateGroup?: string,
  ): Promise<any | null> {
    for (const task of flowableTasks) {
      const vars = await getTaskVariablesFn(task.id);

      const hasMatchingName = task.name === taskName;
      const hasNoPostgresId = !vars.postgres_task_id;

      if (!hasMatchingName || !hasNoPostgresId) {
        continue;
      }

      // Check candidate group if specified
      if (candidateGroup) {
        const taskCandidateGroups = task.candidateGroups ?? [];
        const matchesGroup = taskCandidateGroups.some((g: string) => g.toLowerCase() === candidateGroup.toLowerCase());
        if (matchesGroup) {
          return task;
        }
      } else {
        return task;
      }
    }
    return null;
  }

  /**
   * Determine candidate group from task name or explicit candidate groups
   * @param taskName Task name to infer group from
   * @param candidateGroups Explicit candidate groups if available
   * @returns Appropriate candidate group
   */
  determineCandidateGroup(taskName: string, candidateGroups?: string[]): string {
    // First check explicit candidate groups
    if (candidateGroups && candidateGroups.length > 0) {
      const group = candidateGroups[0].toLowerCase();
      const validGroups: string[] = [CandidateGroups.SUPERVISORS, CandidateGroups.INVESTIGATIONS, CandidateGroups.INVESTIGATOR];
      if (validGroups.includes(group)) {
        return group;
      }
    }

    // Infer from task name
    const normalizedName = taskName.toLowerCase();

    if (normalizedName.includes('approve') || normalizedName.includes('supervisor')) {
      return CandidateGroups.SUPERVISORS;
    } else if (normalizedName.includes('investigate') || normalizedName.includes('investigation')) {
      return CandidateGroups.INVESTIGATIONS;
    } else {
      return CandidateGroups.INVESTIGATIONS; // default
    }
  }

  /**
   * Check if a task has been synced with PostgreSQL
   * @param taskId Flowable task ID
   * @param getTaskVariablesFn Function to get task variables
   * @returns true if task has postgres_task_id variable
   */
  async isTaskSynced(taskId: string, getTaskVariablesFn: (taskId: string) => Promise<Record<string, string>>): Promise<boolean> {
    const vars = await getTaskVariablesFn(taskId);
    return !!vars.postgres_task_id;
  }

  // ==================== Task Variables ====================

  /**
   * Get all variables for a task
   * @param taskId Flowable task ID
   * @returns Record of variable names to values
   */
  async getTaskVariables(taskId: number): Promise<Record<string, unknown>> {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASK_VARIABLES(taskId));

      const variables: Record<string, unknown> = {};
      if (Array.isArray(response.data)) {
        response.data.forEach((variable: unknown) => {
          const varObj = variable as Record<string, unknown>;
          variables[varObj.name as string] = varObj.value as string;
        });
      }

      return variables;
    } catch (error) {
      this.logger.error(`Failed to get task variables: ${error.message}`, error.stack, FlowableUtilitiesService.name);
      return {};
    }
  }
  //   async createTask(taskData: CreateTaskDto, createdBy: string) {
  // return await this.taskBridgeService.createTask(
  // 	{
  // 		caseId: taskData.caseId,
  // 		status: taskData.status,
  // 		name: taskData.name,
  // 		description: taskData.description,
  // 		candidateGroup: taskData.candidateGroup,
  // 	},
  // 	createdBy
  // );
  //   }
}

// Export legacy class names for backward compatibility
export const EventDeduplicator = FlowableUtilitiesService;
export type EventDeduplicator = FlowableUtilitiesService;

export const FlowableTaskFinderService = FlowableUtilitiesService;
export type FlowableTaskFinderService = FlowableUtilitiesService;
