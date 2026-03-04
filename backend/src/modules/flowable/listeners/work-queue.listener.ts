import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableIdentityService } from '../services/flowable-identity.service';

interface WorkQueueBaseEvent {
  workQueueId: string;
  tenantId: string;
  name?: string;
  isActive?: boolean;
  flowableGroupId?: string;
}

interface WorkQueueSyncEvent extends WorkQueueBaseEvent {
  name: string;
  isActive: boolean;
  flowableGroupId: string;
  members?: string[];
}

@Injectable()
export class FlowableWorkQueueListener {
  constructor(
    private readonly flowableIdentityService: FlowableIdentityService,
    private readonly logger: LoggerService,
  ) {}

  @OnEvent('workQueue.created')
  async handleWorkQueueCreated(payload: WorkQueueBaseEvent): Promise<void> {
    if (!payload.flowableGroupId || !payload.name) return;
    try {
      const existing = await this.flowableIdentityService.getGroup(payload.flowableGroupId);
      if (!existing) {
        await this.flowableIdentityService.createGroup({
          id: payload.flowableGroupId,
          name: payload.name,
          type: 'candidate',
        });
        this.logger.log(`Created Flowable group ${payload.flowableGroupId} for queue ${payload.workQueueId}`);
      }
    } catch (e) {
      this.logger.error(`Failed to ensure group for workQueue.created ${payload.workQueueId}: ${e.message}`, e.stack);
    }
  }

  @OnEvent('workQueue.updated')
  async handleWorkQueueUpdated(payload: WorkQueueBaseEvent & { changes?: { name?: string }; oldFlowableGroupId?: string }): Promise<void> {
    try {
      // If name changed, ensure the new group exists
      if (payload.flowableGroupId && payload.name) {
        const existing = await this.flowableIdentityService.getGroup(payload.flowableGroupId);
        if (!existing) {
          await this.flowableIdentityService.createGroup({ id: payload.flowableGroupId, name: payload.name, type: 'candidate' });
          this.logger.log(`Ensured Flowable group ${payload.flowableGroupId} after rename for queue ${payload.workQueueId}`);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to handle workQueue.updated for ${payload.workQueueId}: ${e.message}`, e.stack);
    }
  }

  @OnEvent('workQueue.sync')
  async handleWorkQueueSync(payload: WorkQueueSyncEvent): Promise<void> {
    try {
      const existing = await this.flowableIdentityService.getGroup(payload.flowableGroupId);
      if (!existing) {
        await this.flowableIdentityService.createGroup({ id: payload.flowableGroupId, name: payload.name, type: 'candidate' });
        this.logger.log(`Bootstrapped Flowable group ${payload.flowableGroupId} for queue ${payload.workQueueId}`);
      }

      if (payload.members && payload.members.length > 0) {
        for (const userId of payload.members) {
          try {
            await this.flowableIdentityService.addUserToGroup(payload.flowableGroupId, userId);
          } catch (err) {
            this.logger.warn(`Failed to add user ${userId} to group ${payload.flowableGroupId}: ${err.message}`);
          }
        }
      }
    } catch (e) {
      this.logger.error(`Failed to process workQueue.sync for ${payload.workQueueId}: ${e.message}`, e.stack);
    }
  }

  @OnEvent('workQueue.userAssigned')
  async handleUserAssigned(payload: WorkQueueBaseEvent & { userId: string }): Promise<void> {
    if (!payload.flowableGroupId) return;
    try {
      await this.flowableIdentityService.addUserToGroup(payload.flowableGroupId, payload.userId);
      this.logger.log(`Added user ${payload.userId} to Flowable group ${payload.flowableGroupId}`);
    } catch (e) {
      this.logger.error(`Failed to add user to group for workQueue.userAssigned: ${e.message}`, e.stack);
    }
  }

  @OnEvent('workQueue.userRemoved')
  async handleUserRemoved(payload: WorkQueueBaseEvent & { userId: string }): Promise<void> {
    if (!payload.flowableGroupId) return;
    try {
      await this.flowableIdentityService.removeUserFromGroup(payload.flowableGroupId, payload.userId);
      this.logger.log(`Removed user ${payload.userId} from Flowable group ${payload.flowableGroupId}`);
    } catch (e) {
      this.logger.error(`Failed to remove user from group for workQueue.userRemoved: ${e.message}`, e.stack);
    }
  }
}
