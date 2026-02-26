import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints } from '../../../constants/flowable-api.constants';
import { FlowableClientFactory } from './flowable-client.factory';

/**
 * Service responsible for Flowable identity and group management
 * Handles users, groups, and work queue statistics
 */
@Injectable()
export class FlowableIdentityService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  /**
   * Add a user to a Flowable identity group
   */
  async addUserToGroup(groupId: string, userId: string) {
    try {
      const response = await this.flowableClient.post(FlowableApiEndpoints.GROUP_MEMBERS(groupId), {
        userId,
      });
      return response.data;
    } catch (error) {
      // 409 means membership already exists; treat as success
      if (error.response?.status === 409) {
        this.logger.log(`User ${userId} already a member of group ${groupId}`, FlowableIdentityService.name);
        return null;
      }
      this.logger.error(`Failed to add user ${userId} to group ${groupId}: ${error.message}`, error.stack, FlowableIdentityService.name);
      throw new HttpException('Failed to add user to group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Remove a user from a Flowable identity group
   */
  async removeUserFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      await this.flowableClient.delete(FlowableApiEndpoints.GROUP_MEMBER(groupId, userId));
    } catch (error) {
      if (error.response?.status === 404) {
        // Not a member; ignore
        return;
      }
      this.logger.error(
        `Failed to remove user ${userId} from group ${groupId}: ${error.message}`,
        error.stack,
        FlowableIdentityService.name,
      );
      throw new HttpException('Failed to remove user from group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create a new Flowable group
   */
  async createGroup(groupData: { id: string; name: string; type: string }) {
    try {
      const response = await this.flowableClient.post(FlowableApiEndpoints.GROUPS, groupData);
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        this.logger.log(`Group ${groupData.id} already exists`, FlowableIdentityService.name);
        return null;
      }
      throw new HttpException(`Failed to create group: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a group by ID
   */
  async getGroup(groupId: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.GROUP(groupId));
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException(`Failed to get group: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get all candidate groups
   */
  async getAllCandidateGroups(size?: number, start?: number) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.GROUPS, {
        params: {
          type: 'candidate',
          size,
          start,
        },
      });
      return response.data.data ?? [];
    } catch (error) {
      this.logger.error(`Failed to get candidate groups: ${error.message}`, error.stack, FlowableIdentityService.name);
      return [];
    }
  }

  /**
   * Get all tasks assigned to a specific user
   */
  async getTasksAssignedToUser(assignee: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASKS, {
        params: {
          assignee,
          includeProcessVariables: true,
          includeTaskLocalVariables: true,
        },
      });
      return response.data.data ?? [];
    } catch (error) {
      this.logger.error(`Failed to get tasks for assignee ${assignee}: ${error.message}`, error.stack, FlowableIdentityService.name);
      throw new HttpException('Failed to get tasks for assignee', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get work queue statistics for candidate groups
   *
   * @param flowableClient - Axios instance for Flowable API
   * @param getCandidateGroupTasksFn - Function to get tasks for a group (injected to avoid circular dependency)
   * @param candidateGroup - Optional specific group to get stats for
   */
  async getWorkQueueStatistics(
    flowableClient: AxiosInstance,
    getCandidateGroupTasksFn: (group: string, includeVariables: boolean) => Promise<any[]>,
    candidateGroup?: string,
  ): Promise<Record<string, unknown>> {
    try {
      const allGroups = candidateGroup ? [candidateGroup] : await this.getAllCandidateGroups();
      const groups = candidateGroup ? [candidateGroup] : allGroups.map((group: any) => group.id);
      const statistics: Record<string, unknown> = {};

      for (const group of groups) {
        const tasks = await getCandidateGroupTasksFn(group, false);

        statistics[group] = {
          total: tasks.length,
          unassigned: tasks.filter((t: unknown) => !(t as Record<string, unknown>).assignee).length,
          assigned: tasks.filter((t: unknown) => !!(t as Record<string, unknown>).assignee).length,
        };
      }

      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get work queue statistics: ${error.message}`, error.stack, FlowableIdentityService.name);
      throw new HttpException('Failed to get work queue statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
