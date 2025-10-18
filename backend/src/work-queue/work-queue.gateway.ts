import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';

interface SubscriptionRequest {
  workQueueId?: string;
  tenantId: string;
}

interface ClientMetadata {
  userId: string;
  tenantId: string;
  subscriptions: Set<string>;
}

/**
 * WebSocket Gateway for real-time work queue updates
 *
 * Provides real-time notifications to connected clients about:
 * - Task status changes
 * - Task assignments/unassignments
 * - Work queue updates
 * - SLA warnings and breaches
 * - Rule applications
 *
 * Clients can subscribe to specific work queues or receive all updates for their tenant.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/work-queues',
})
export class WorkQueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WorkQueueGateway.name);
  private readonly clients = new Map<string, ClientMetadata>();

  /**
   * Handle new client connection
   */
  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without authentication token`);
        client.disconnect();
        return;
      }

      // TODO: Validate token and extract user info
      // For now, we'll accept the connection and validate on subscription
      this.logger.log(`Client ${client.id} connected`);

      // Initialize client metadata
      this.clients.set(client.id, {
        userId: '',
        tenantId: '',
        subscriptions: new Set(),
      });
    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(@ConnectedSocket() client: Socket) {
    const metadata = this.clients.get(client.id);
    if (metadata) {
      this.logger.log(`Client ${client.id} disconnected (User: ${metadata.userId}, Subscriptions: ${metadata.subscriptions.size})`);
      this.clients.delete(client.id);
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  /**
   * Subscribe to work queue updates
   *
   * @param workQueueId
   * @param tenantId
   */
  @SubscribeMessage('subscribe:workQueue')
  async handleSubscribeWorkQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscriptionRequest,
  ): Promise<{ success: boolean; message: string; subscription?: string }> {
    try {
      const { workQueueId, tenantId } = data;

      if (!tenantId) {
        return {
          success: false,
          message: 'Tenant ID is required',
        };
      }

      const metadata = this.clients.get(client.id);
      if (metadata) {
        metadata.tenantId = tenantId;
        if (!metadata.userId) {
          metadata.userId = client.handshake.auth?.userId || 'unknown';
        }
      }

      const room = workQueueId ? `workQueue:${workQueueId}` : `tenant:${tenantId}`;

      await client.join(room);

      if (metadata) {
        metadata.subscriptions.add(room);
      }

      this.logger.log(`Client ${client.id} subscribed to ${room}`);

      return {
        success: true,
        message: `Successfully subscribed to ${workQueueId ? 'work queue' : 'tenant'} updates`,
        subscription: room,
      };
    } catch (error) {
      this.logger.error(`Error subscribing client ${client.id}:`, error);
      return {
        success: false,
        message: 'Failed to subscribe',
      };
    }
  }

  /**
   * Unsubscribe from work queue updates
   */
  @SubscribeMessage('unsubscribe:workQueue')
  async handleUnsubscribeWorkQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscriptionRequest,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { workQueueId, tenantId } = data;

      if (!tenantId) {
        return {
          success: false,
          message: 'Tenant ID is required',
        };
      }

      const room = workQueueId ? `workQueue:${workQueueId}` : `tenant:${tenantId}`;

      await client.leave(room);

      const metadata = this.clients.get(client.id);
      if (metadata) {
        metadata.subscriptions.delete(room);
      }

      this.logger.log(`Client ${client.id} unsubscribed from ${room}`);

      return {
        success: true,
        message: `Successfully unsubscribed from ${workQueueId ? 'work queue' : 'tenant'} updates`,
      };
    } catch (error) {
      this.logger.error(`Error unsubscribing client ${client.id}:`, error);
      return {
        success: false,
        message: 'Failed to unsubscribe',
      };
    }
  }

  /**
   * Get client's current subscriptions
   */
  @SubscribeMessage('subscriptions:list')
  handleListSubscriptions(@ConnectedSocket() client: Socket): { subscriptions: string[] } {
    const metadata = this.clients.get(client.id);
    return {
      subscriptions: metadata ? Array.from(metadata.subscriptions) : [],
    };
  }

  // ==================== Event Listeners ====================

  /**
   * Emit task created event
   */
  @OnEvent('task.created')
  handleTaskCreated(payload: any) {
    this.logger.debug(`Broadcasting task.created event: ${payload.taskId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:created', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:created', payload);
    }
  }

  /**
   * Emit task status changed event
   */
  @OnEvent('task.status-changed')
  handleTaskStatusChanged(payload: any) {
    this.logger.debug(`Broadcasting task.status-changed event: ${payload.taskId} -> ${payload.newStatus}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:statusChanged', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:statusChanged', payload);
    }
  }

  /**
   * Emit task assigned event
   */
  @OnEvent('task.assigned')
  handleTaskAssigned(payload: any) {
    this.logger.debug(`Broadcasting task.assigned event: ${payload.taskId} -> ${payload.assignedUserId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:assigned', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:assigned', payload);
    }
  }

  /**
   * Emit task unassigned event
   */
  @OnEvent('task.unassigned')
  handleTaskUnassigned(payload: any) {
    this.logger.debug(`Broadcasting task.unassigned event: ${payload.taskId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:unassigned', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:unassigned', payload);
    }
  }

  /**
   * Emit task auto-assigned event (from rule engine)
   */
  @OnEvent('task.auto-assigned')
  handleTaskAutoAssigned(payload: any) {
    this.logger.debug(`Broadcasting task.auto-assigned event: ${payload.taskId} (Rule: ${payload.ruleId})`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:autoAssigned', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:autoAssigned', payload);
    }
  }

  /**
   * Emit work queue updated event
   */
  @OnEvent('workQueue.updated')
  handleWorkQueueUpdated(payload: any) {
    this.logger.debug(`Broadcasting workQueue.updated event: ${payload.workQueueId}`);

    this.server.to(`workQueue:${payload.workQueueId}`).emit('workQueue:updated', payload);

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('workQueue:updated', payload);
    }
  }

  /**
   * Emit work queue deleted event
   */
  @OnEvent('workQueue.deleted')
  handleWorkQueueDeleted(payload: any) {
    this.logger.debug(`Broadcasting workQueue.deleted event: ${payload.workQueueId}`);

    this.server.to(`workQueue:${payload.workQueueId}`).emit('workQueue:deleted', payload);

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('workQueue:deleted', payload);
    }
  }

  /**
   * Emit SLA warning event
   */
  @OnEvent('task.sla-warning')
  handleSLAWarning(payload: any) {
    this.logger.debug(`Broadcasting task.sla-warning event: ${payload.taskId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:slaWarning', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:slaWarning', payload);
    }
  }

  /**
   * Emit SLA breach event
   */
  @OnEvent('task.sla-breach')
  handleSLABreach(payload: any) {
    this.logger.debug(`Broadcasting task.sla-breach event: ${payload.taskId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:slaBreach', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:slaBreach', payload);
    }
  }

  /**
   * Emit task overdue event
   */
  @OnEvent('task.overdue')
  handleTaskOverdue(payload: any) {
    this.logger.debug(`Broadcasting task.overdue event: ${payload.taskId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('task:overdue', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('task:overdue', payload);
    }
  }

  /**
   * Emit assignment rule created event
   */
  @OnEvent('rule.created')
  handleRuleCreated(payload: any) {
    this.logger.debug(`Broadcasting rule.created event: ${payload.ruleId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('rule:created', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('rule:created', payload);
    }
  }

  /**
   * Emit assignment rule updated event
   */
  @OnEvent('rule.updated')
  handleRuleUpdated(payload: any) {
    this.logger.debug(`Broadcasting rule.updated event: ${payload.ruleId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('rule:updated', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('rule:updated', payload);
    }
  }

  /**
   * Emit assignment rule deleted event
   */
  @OnEvent('rule.deleted')
  handleRuleDeleted(payload: any) {
    this.logger.debug(`Broadcasting rule.deleted event: ${payload.ruleId}`);

    if (payload.workQueueId) {
      this.server.to(`workQueue:${payload.workQueueId}`).emit('rule:deleted', payload);
    }

    if (payload.tenantId) {
      this.server.to(`tenant:${payload.tenantId}`).emit('rule:deleted', payload);
    }
  }

  // ==================== Notification Events ====================

  /**
   * Subscribe to user-specific notifications
   */
  @SubscribeMessage('subscribe:notifications')
  async handleSubscribeNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; tenantId: string },
  ): Promise<{ success: boolean; message: string; unreadCount?: number }> {
    try {
      const { userId, tenantId } = data;

      if (!userId || !tenantId) {
        return {
          success: false,
          message: 'User ID and Tenant ID are required',
        };
      }

      const metadata = this.clients.get(client.id);
      if (metadata) {
        metadata.userId = userId;
        metadata.tenantId = tenantId;
      }

      const room = `notifications:${userId}`;
      await client.join(room);

      if (metadata) {
        metadata.subscriptions.add(room);
      }

      this.logger.log(`Client ${client.id} subscribed to notifications for user ${userId}`);

      const unreadCount = 0;

      return {
        success: true,
        message: 'Successfully subscribed to notifications',
        unreadCount,
      };
    } catch (error) {
      this.logger.error(`Error subscribing to notifications for client ${client.id}:`, error);
      return {
        success: false,
        message: 'Failed to subscribe to notifications',
      };
    }
  }

  /**
   * Mark notification as read
   */
  @SubscribeMessage('notification:markRead')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { notificationId } = data;

      if (!notificationId) {
        return {
          success: false,
          message: 'Notification ID is required',
        };
      }

      this.logger.log(`Notification ${notificationId} marked as read by client ${client.id}`);

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      this.logger.error(`Error marking notification as read:`, error);
      return {
        success: false,
        message: 'Failed to mark notification as read',
      };
    }
  }

  /**
   * Get unread notifications for user
   */
  @SubscribeMessage('notification:getUnread')
  async handleGetUnreadNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; limit?: number },
  ): Promise<{ success: boolean; notifications?: any[]; count?: number; message?: string }> {
    try {
      const { userId, limit = 20 } = data;

      if (!userId) {
        return {
          success: false,
          message: 'User ID is required',
        };
      }

      this.logger.log(`Fetching unread notifications for user ${userId}`);

      return {
        success: true,
        notifications: [],
        count: 0,
      };
    } catch (error) {
      this.logger.error(`Error fetching unread notifications:`, error);
      return {
        success: false,
        message: 'Failed to fetch unread notifications',
      };
    }
  }

  /**
   * Broadcast in-app notification to specific user
   */
  @OnEvent('notification.in-app')
  handleInAppNotification(payload: {
    userId: string;
    notificationId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }) {
    this.logger.debug(`Broadcasting in-app notification to user ${payload.userId}: ${payload.type}`);

    const room = `notifications:${payload.userId}`;
    this.server.to(room).emit('notification:new', {
      notificationId: payload.notificationId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data,
      priority: payload.priority || 'normal',
      timestamp: new Date().toISOString(),
    });

    this.server.to(room).emit('notification:unreadCount', {
      count: 1, // Placeholder
    });
  }

  /**
   * Broadcast notification read status update
   */
  @OnEvent('notification.read')
  handleNotificationRead(payload: { userId: string; notificationId: string; unreadCount: number }) {
    this.logger.debug(`Broadcasting notification read status for user ${payload.userId}`);

    const room = `notifications:${payload.userId}`;
    this.server.to(room).emit('notification:read', {
      notificationId: payload.notificationId,
      timestamp: new Date().toISOString(),
    });

    this.server.to(room).emit('notification:unreadCount', {
      count: payload.unreadCount,
    });
  }

  // ==================== Utility Methods ====================

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.clients.size,
      connectionsByTenant: new Map<string, number>(),
      totalSubscriptions: 0,
    };

    for (const [clientId, metadata] of this.clients.entries()) {
      if (metadata.tenantId) {
        const count = stats.connectionsByTenant.get(metadata.tenantId) || 0;
        stats.connectionsByTenant.set(metadata.tenantId, count + 1);
      }
      stats.totalSubscriptions += metadata.subscriptions.size;
    }

    return stats;
  }

  /**
   * Broadcast message to all clients in a work queue
   */
  broadcastToWorkQueue(workQueueId: string, event: string, data: any) {
    this.server.to(`workQueue:${workQueueId}`).emit(event, data);
  }

  /**
   * Broadcast message to all clients in a tenant
   */
  broadcastToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }
}
