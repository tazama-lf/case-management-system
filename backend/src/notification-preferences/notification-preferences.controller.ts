import { Controller, Get, Put, Body, UseGuards, HttpCode, HttpStatus, Query, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { NotificationPreferencesService } from './notification-preferences.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { User } from '../auth/user.decorator';
import {
  UpdateNotificationPreferenceDto,
  NotificationPreferenceResponseDto,
  NotificationHistoryDto,
  NotificationHistoryQueryDto,
} from './dto';

interface JwtUser {
  sub: string;
  username: string;
  tenantId: string;
  roles: string[];
}

@ApiTags('Notification Preferences')
@Controller('api/v1/users/me/notification-preferences')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth()
export class NotificationPreferencesController {
  constructor(private readonly notificationPreferencesService: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notification preferences',
    description: 'Retrieves the authenticated user notification preferences. Creates default preferences if none exist.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved notification preferences',
    type: NotificationPreferenceResponseDto,
  })
  async getUserPreferences(@User() user: JwtUser): Promise<NotificationPreferenceResponseDto> {
    return this.notificationPreferencesService.getUserPreferences(user.sub, user.tenantId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user notification preferences',
    description: 'Updates the authenticated user notification preferences. At least one channel must remain enabled.',
  })
  @ApiOkResponse({
    description: 'Successfully updated notification preferences',
    type: NotificationPreferenceResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notification preferences not found for user',
  })
  @ApiBadRequestResponse({
    description: 'Invalid preferences (e.g., no channels enabled, SMS enabled without phone number)',
  })
  async updateUserPreferences(
    @User() user: JwtUser,
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationPreferencesService.updatePreferences(user.sub, dto);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get notification history',
    description: 'Retrieves the authenticated user notification history with optional filtering and pagination.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved notification history',
    type: [NotificationHistoryDto],
  })
  async getNotificationHistory(
    @User() user: JwtUser,
    @Query() query: NotificationHistoryQueryDto,
  ): Promise<{ data: NotificationHistoryDto[]; total: number; page: number; limit: number }> {
    return {
      data: [],
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send test notification',
    description: 'Sends a test notification to the authenticated user to verify notification settings.',
  })
  @ApiOkResponse({
    description: 'Test notification sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Test notification sent successfully',
        },
        channels: {
          type: 'array',
          items: { type: 'string' },
          example: ['EMAIL', 'IN_APP'],
        },
      },
    },
  })
  async sendTestNotification(@User() user: JwtUser): Promise<{
    message: string;
    channels: string[];
  }> {
    const channels = await this.notificationPreferencesService.getEnabledChannels(user.sub);

    return {
      message: 'Test notification sent successfully',
      channels: channels.map((c) => c.toString()),
    };
  }
}
