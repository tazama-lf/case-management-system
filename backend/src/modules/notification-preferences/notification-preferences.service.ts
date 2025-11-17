import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationChannel, NotificationType, UserNotificationPreference } from '@prisma/client';
import { CreateNotificationPreferenceDto, UpdateNotificationPreferenceDto, NotificationPreferenceResponseDto } from './dto';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user notification preferences. Creates default if none exist.
   */
  async getUserPreferences(userId: string, tenantId: string): Promise<NotificationPreferenceResponseDto> {
    this.logger.log(`Getting preferences for user: ${userId}`);

    let preferences = await this.prisma.userNotificationPreference.findUnique({
      where: { user_id: userId },
    });

    if (!preferences) {
      this.logger.log(`No preferences found for user ${userId}, creating defaults`);
      preferences = await this.createDefaultPreferences(userId, tenantId);
    }

    return this.mapToResponseDto(preferences);
  }

  /**
   * Create new notification preferences for a user
   */
  async createPreferences(
    userId: string,
    tenantId: string,
    dto: CreateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    this.logger.log(`Creating preferences for user: ${userId}`);

    this.validateChannels(dto);

    if (dto.sms_enabled && !dto.phone_number) {
      throw new BadRequestException('Phone number is required when SMS notifications are enabled');
    }

    try {
      const preferences = await this.prisma.userNotificationPreference.create({
        data: {
          user_id: userId,
          tenant_id: tenantId,
          email_enabled: dto.email_enabled ?? true,
          in_app_enabled: dto.in_app_enabled ?? true,
          sms_enabled: dto.sms_enabled ?? false,
          dashboard_enabled: dto.dashboard_enabled ?? true,
          phone_number: dto.phone_number,
          suppression_settings: dto.suppression_settings ? JSON.stringify(dto.suppression_settings) : undefined,
          default_channel: dto.default_channel ?? NotificationChannel.EMAIL,
        },
      });

      return this.mapToResponseDto(preferences);
    } catch (error) {
      this.logger.error(`Error creating preferences for user ${userId}:`, error);
      throw new BadRequestException('Failed to create notification preferences');
    }
  }

  /**
   * Update existing notification preferences
   */
  async updatePreferences(userId: string, dto: UpdateNotificationPreferenceDto): Promise<NotificationPreferenceResponseDto> {
    this.logger.log(`Updating preferences for user: ${userId}`);

    const existing = await this.prisma.userNotificationPreference.findUnique({
      where: { user_id: userId },
    });

    if (!existing) {
      throw new NotFoundException(`Notification preferences not found for user ${userId}`);
    }

    const updatedChannels = {
      email_enabled: dto.email_enabled ?? existing.email_enabled,
      in_app_enabled: dto.in_app_enabled ?? existing.in_app_enabled,
      sms_enabled: dto.sms_enabled ?? existing.sms_enabled,
      dashboard_enabled: dto.dashboard_enabled ?? existing.dashboard_enabled,
    };
    this.validateChannels(updatedChannels);

    const smsEnabled = dto.sms_enabled ?? existing.sms_enabled;
    const phoneNumber = dto.phone_number ?? existing.phone_number;
    if (smsEnabled && !phoneNumber) {
      throw new BadRequestException('Phone number is required when SMS notifications are enabled');
    }

    try {
      const updated = await this.prisma.userNotificationPreference.update({
        where: { user_id: userId },
        data: {
          email_enabled: dto.email_enabled,
          in_app_enabled: dto.in_app_enabled,
          sms_enabled: dto.sms_enabled,
          dashboard_enabled: dto.dashboard_enabled,
          phone_number: dto.phone_number,
          suppression_settings: dto.suppression_settings ? JSON.stringify(dto.suppression_settings) : undefined,
          default_channel: dto.default_channel,
        },
      });

      return this.mapToResponseDto(updated);
    } catch (error) {
      this.logger.error(`Error updating preferences for user ${userId}:`, error);
      throw new BadRequestException('Failed to update notification preferences');
    }
  }

  /**
   * Check if a specific notification should be sent to a user
   */
  async shouldSendNotification(userId: string, notificationType: NotificationType): Promise<boolean> {
    const preferences = await this.prisma.userNotificationPreference.findUnique({
      where: { user_id: userId },
    });

    if (!preferences) {
      return true;
    }

    if (preferences.suppression_settings) {
      const suppressedTypes = JSON.parse(preferences.suppression_settings as string) as string[];
      if (suppressedTypes.includes(notificationType)) {
        this.logger.log(`Notification ${notificationType} suppressed for user ${userId}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get enabled channels for a user
   */
  async getEnabledChannels(userId: string): Promise<NotificationChannel[]> {
    const preferences = await this.prisma.userNotificationPreference.findUnique({
      where: { user_id: userId },
    });

    if (!preferences) {
      return [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.DASHBOARD];
    }

    const channels: NotificationChannel[] = [];
    if (preferences.email_enabled) channels.push(NotificationChannel.EMAIL);
    if (preferences.in_app_enabled) channels.push(NotificationChannel.IN_APP);
    if (preferences.sms_enabled && preferences.phone_number) channels.push(NotificationChannel.SMS);
    if (preferences.dashboard_enabled) channels.push(NotificationChannel.DASHBOARD);

    return channels;
  }

  /**
   * Get user's default notification channel
   */
  async getDefaultChannel(userId: string): Promise<NotificationChannel> {
    const preferences = await this.prisma.userNotificationPreference.findUnique({
      where: { user_id: userId },
    });

    return preferences?.default_channel ?? NotificationChannel.EMAIL;
  }

  /**
   * Get user's phone number for SMS notifications
   */
  async getUserPhoneNumber(userId: string): Promise<string | null> {
    const preferences = await this.prisma.userNotificationPreference.findUnique({
      where: { user_id: userId },
      select: { phone_number: true, sms_enabled: true },
    });

    if (preferences?.sms_enabled && preferences?.phone_number) {
      return preferences.phone_number;
    }

    return null;
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultPreferences(userId: string, tenantId: string): Promise<UserNotificationPreference> {
    return this.prisma.userNotificationPreference.create({
      data: {
        user_id: userId,
        tenant_id: tenantId,
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: false,
        dashboard_enabled: true,
        default_channel: NotificationChannel.EMAIL,
      },
    });
  }

  /**
   * Validate that at least one notification channel is enabled
   */
  private validateChannels(channels: {
    email_enabled?: boolean;
    in_app_enabled?: boolean;
    sms_enabled?: boolean;
    dashboard_enabled?: boolean;
  }): void {
    const hasEnabledChannel = channels.email_enabled || channels.in_app_enabled || channels.sms_enabled || channels.dashboard_enabled;

    if (!hasEnabledChannel) {
      throw new BadRequestException('At least one notification channel must be enabled');
    }
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponseDto(preferences: UserNotificationPreference): NotificationPreferenceResponseDto {
    return {
      preference_id: preferences.preference_id,
      user_id: preferences.user_id,
      tenant_id: preferences.tenant_id,
      email_enabled: preferences.email_enabled,
      in_app_enabled: preferences.in_app_enabled,
      sms_enabled: preferences.sms_enabled,
      dashboard_enabled: preferences.dashboard_enabled,
      phone_number: preferences.phone_number,
      suppression_settings: preferences.suppression_settings ? (JSON.parse(preferences.suppression_settings as string) as string[]) : null,
      default_channel: preferences.default_channel,
      created_at: preferences.created_at,
      updated_at: preferences.updated_at,
    };
  }
}
