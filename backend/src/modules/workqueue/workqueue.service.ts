import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from '../flowable/flowable.service';

@Injectable()
export class WorkqueueService {
  constructor(
    private readonly flowableService: FlowableService,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Create a candidate group (workqueue) in Flowable
   * @param groupId - Unique identifier for the group
   * @param groupName - Display name for the group
   * @param groupType - Type of group (defaults to 'candidate')
   */
  async createCandidateGroup(groupId: string, groupName: string, groupType: string = 'candidate') {
    try {
      this.loggerService.log(`Creating candidate group: ${groupId}`, WorkqueueService.name);

      const groupData = {
        id: groupId.toLowerCase(),
        name: groupName,
        type: groupType,
      };

      const result = await this.flowableService.createGroup(groupData);

      this.loggerService.log(`Candidate group created successfully: ${groupId}`, WorkqueueService.name);
      return result;
    } catch (error) {
      this.loggerService.error(`Failed to create candidate group ${groupId}: ${error.message}`, error.stack, WorkqueueService.name);
      throw new HttpException('Failed to create candidate group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a candidate group by ID
   * @param groupId - The group identifier
   */
  async getCandidateGroup(groupId: string) {
    try {
      this.loggerService.log(`Retrieving candidate group: ${groupId}`, WorkqueueService.name);

      const result = await this.flowableService.getGroup(groupId.toLowerCase());

      return result;
    } catch (error) {
      this.loggerService.error(`Failed to get candidate group ${groupId}: ${error.message}`, error.stack, WorkqueueService.name);
      throw new HttpException('Failed to get candidate group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get tasks for a candidate group
   * @param groupId - The group identifier
   * @param includeVariables - Whether to include task variables
   */
  async getCandidateGroupTasks(groupId: string, includeVariables: boolean = true) {
    try {
      this.loggerService.log(`Getting tasks for candidate group: ${groupId}`, WorkqueueService.name);

      const tasks = await this.flowableService.getCandidateGroupTasks(groupId.toLowerCase(), includeVariables);

      this.loggerService.log(`Retrieved ${tasks.length} tasks for candidate group ${groupId}`, WorkqueueService.name);
      return tasks;
    } catch (error) {
      this.loggerService.error(`Failed to get tasks for candidate group ${groupId}: ${error.message}`, error.stack, WorkqueueService.name);
      throw new HttpException('Failed to get candidate group tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get work queue statistics for a candidate group
   * @param groupId - Optional group identifier, if not provided returns stats for all groups
   */
  async getWorkQueueStatistics(groupId?: string) {
    try {
      this.loggerService.log(`Getting work queue statistics${groupId ? ` for group: ${groupId}` : ''}`, WorkqueueService.name);

      const stats = await this.flowableService.getWorkQueueStatistics(groupId?.toLowerCase());

      return stats;
    } catch (error) {
      this.loggerService.error(`Failed to get work queue statistics: ${error.message}`, error.stack, WorkqueueService.name);
      throw new HttpException('Failed to get work queue statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
