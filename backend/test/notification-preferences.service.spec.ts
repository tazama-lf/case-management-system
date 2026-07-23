import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesService } from '../src/modules/notification-preferences/notification-preferences.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client-cms';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let prisma: PrismaService;

  const mockPreference = {
    preference_id: 1,
    user_id: 'user-123',
    tenant_id: 'tenant-123',
    email_enabled: true,
    in_app_enabled: true,
    sms_enabled: false,
    dashboard_enabled: true,
    phone_number: null,
    suppression_settings: null,
    default_channel: NotificationChannel.EMAIL,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPrismaService = {
    userNotificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return existing preferences', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);

      const result = await service.getUserPreferences('user-123', 'tenant-123');

      expect(result).toBeDefined();
      expect(result.user_id).toBe('user-123');
      expect(result.email_enabled).toBe(true);
      expect(prisma.userNotificationPreference.findUnique).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
      });
    });

    it('should create default preferences when none exist', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(mockPreference);

      const result = await service.getUserPreferences('user-123', 'tenant-123');

      expect(result).toBeDefined();
      expect(prisma.userNotificationPreference.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          tenant_id: 'tenant-123',
          email_enabled: true,
          in_app_enabled: true,
          sms_enabled: false,
          dashboard_enabled: true,
          default_channel: NotificationChannel.EMAIL,
        },
      });
    });

    it.each([
      ['JSON array', JSON.stringify(['TASK_ASSIGNED', 'TASK_OVERDUE']), ['TASK_ASSIGNED', 'TASK_OVERDUE']],
      ['null', null, null],
    ])('should handle suppression_settings as %s', async (_description, dbValue, expectedValue) => {
      const preferenceWithSuppression = {
        ...mockPreference,
        suppression_settings: dbValue,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(preferenceWithSuppression);

      const result = await service.getUserPreferences('user-123', 'tenant-123');

      expect(result.suppression_settings).toEqual(expectedValue);
    });
  });

  describe('createPreferences', () => {
    it('should create preferences with valid data', async () => {
      const dto = {
        email_enabled: true,
        in_app_enabled: false,
        sms_enabled: false,
        dashboard_enabled: true,
        default_channel: NotificationChannel.EMAIL,
      };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(mockPreference);

      const result = await service.createPreferences('user-123', 'tenant-123', dto);

      expect(result).toBeDefined();
      expect(prisma.userNotificationPreference.create).toHaveBeenCalled();
    });

    it('should throw error when no channels are enabled', async () => {
      const dto = {
        email_enabled: false,
        in_app_enabled: false,
        sms_enabled: false,
        dashboard_enabled: false,
      };

      await expect(service.createPreferences('user-123', 'tenant-123', dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when SMS enabled without phone number', async () => {
      const dto = {
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: true,
        dashboard_enabled: true,
      };

      await expect(service.createPreferences('user-123', 'tenant-123', dto)).rejects.toThrow(
        'Phone number is required when SMS notifications are enabled',
      );
    });

    it('should create preferences with SMS when phone number provided', async () => {
      const dto = {
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: true,
        dashboard_enabled: true,
        phone_number: '+1234567890',
      };
      const preferenceWithSMS = { ...mockPreference, sms_enabled: true, phone_number: '+1234567890' };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(preferenceWithSMS);

      const result = await service.createPreferences('user-123', 'tenant-123', dto);

      expect(result.sms_enabled).toBe(true);
      expect(result.phone_number).toBe('+1234567890');
    });

    it('should create preferences with suppression settings', async () => {
      const dto = {
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: false,
        dashboard_enabled: true,
        suppression_settings: ['TASK_ASSIGNED', 'SLA_BREACH'],
      };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(mockPreference);

      await service.createPreferences('user-123', 'tenant-123', dto);

      const createCall = (prisma.userNotificationPreference.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.suppression_settings).toBeDefined();
      expect(JSON.parse(createCall.data.suppression_settings)).toEqual(['TASK_ASSIGNED', 'SLA_BREACH']);
    });

    it('should use default values when not provided', async () => {
      const dto = {
        email_enabled: true, // At least one channel must be enabled
      };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(mockPreference);

      await service.createPreferences('user-123', 'tenant-123', dto);

      const createCall = (prisma.userNotificationPreference.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.email_enabled).toBe(true);
      expect(createCall.data.in_app_enabled).toBe(true); // default
      expect(createCall.data.sms_enabled).toBe(false); // default
      expect(createCall.data.dashboard_enabled).toBe(true); // default
      expect(createCall.data.default_channel).toBe(NotificationChannel.EMAIL); // default
    });

    it('should handle empty suppression_settings array', async () => {
      const dto = {
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: false,
        dashboard_enabled: true,
        suppression_settings: [],
      };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(mockPreference);

      await service.createPreferences('user-123', 'tenant-123', dto);

      const createCall = (prisma.userNotificationPreference.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.suppression_settings).toBeDefined();
      expect(JSON.parse(createCall.data.suppression_settings)).toEqual([]);
    });

    it('should enforce tenant isolation in preferences creation', async () => {
      const dto = {
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: false,
        dashboard_enabled: true,
      };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue(mockPreference);

      await service.createPreferences('user-123', 'tenant-123', dto);

      const createCall = (prisma.userNotificationPreference.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.tenant_id).toBe('tenant-123');
      expect(createCall.data.user_id).toBe('user-123');
    });

    it('should handle database errors gracefully', async () => {
      const dto = { email_enabled: true };
      (prisma.userNotificationPreference.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.createPreferences('user-123', 'tenant-123', dto)).rejects.toThrow('Failed to create notification preferences');
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preferences', async () => {
      const dto = {
        email_enabled: false,
        in_app_enabled: true,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);
      (prisma.userNotificationPreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        email_enabled: false,
      });

      const result = await service.updatePreferences('user-123', dto);

      expect(result.email_enabled).toBe(false);
      expect(prisma.userNotificationPreference.update).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        data: expect.objectContaining(dto),
      });
    });

    it('should throw NotFoundException when preferences do not exist', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updatePreferences('user-123', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw error when updating to disable all channels', async () => {
      const dto = {
        email_enabled: false,
        in_app_enabled: false,
        sms_enabled: false,
        dashboard_enabled: false,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);

      await expect(service.updatePreferences('user-123', dto)).rejects.toThrow('At least one notification channel must be enabled');
    });

    it('should throw error when enabling SMS without phone number', async () => {
      const dto = {
        sms_enabled: true,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);

      await expect(service.updatePreferences('user-123', dto)).rejects.toThrow(
        'Phone number is required when SMS notifications are enabled',
      );
    });

    it('should update SMS when phone number exists', async () => {
      const existingWithPhone = { ...mockPreference, phone_number: '+1234567890' };
      const dto = {
        sms_enabled: true,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(existingWithPhone);
      (prisma.userNotificationPreference.update as jest.Mock).mockResolvedValue({
        ...existingWithPhone,
        sms_enabled: true,
      });

      const result = await service.updatePreferences('user-123', dto);

      expect(result.sms_enabled).toBe(true);
    });

    it('should update phone number', async () => {
      const dto = {
        phone_number: '+9876543210',
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);
      (prisma.userNotificationPreference.update as jest.Mock).mockResolvedValue({
        ...mockPreference,
        phone_number: '+9876543210',
      });

      const result = await service.updatePreferences('user-123', dto);

      expect(result.phone_number).toBe('+9876543210');
    });

    it('should update suppression settings', async () => {
      const dto = {
        suppression_settings: ['TASK_REASSIGNED', 'WORK_QUEUE_ADDED'],
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);
      (prisma.userNotificationPreference.update as jest.Mock).mockResolvedValue(mockPreference);

      await service.updatePreferences('user-123', dto);

      const updateCall = (prisma.userNotificationPreference.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.suppression_settings).toBeDefined();
    });

    it('should handle database errors during update', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);
      (prisma.userNotificationPreference.update as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.updatePreferences('user-123', { email_enabled: true })).rejects.toThrow(
        'Failed to update notification preferences',
      );
    });
  });

  describe('shouldSendNotification', () => {
    it('should return true when no preferences exist', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.shouldSendNotification('user-123', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(true);
    });

    it('should return true when notification type is not suppressed', async () => {
      const preferenceWithSuppression = {
        ...mockPreference,
        suppression_settings: JSON.stringify(['TASK_OVERDUE']),
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(preferenceWithSuppression);

      const result = await service.shouldSendNotification('user-123', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(true);
    });

    it('should return false when notification type is suppressed', async () => {
      const preferenceWithSuppression = {
        ...mockPreference,
        suppression_settings: JSON.stringify(['TASK_ASSIGNED', 'TASK_OVERDUE']),
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(preferenceWithSuppression);

      const result = await service.shouldSendNotification('user-123', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(false);
    });

    it('should return true when suppression_settings is null', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);

      const result = await service.shouldSendNotification('user-123', NotificationType.TASK_ASSIGNED);

      expect(result).toBe(true);
    });
  });

  describe('getEnabledChannels', () => {
    it('should return default channels when no preferences exist', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getEnabledChannels('user-123');

      expect(result).toEqual([NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.DASHBOARD]);
    });

    it('should return all enabled channels', async () => {
      const allEnabledPreference = {
        ...mockPreference,
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: true,
        dashboard_enabled: true,
        phone_number: '+1234567890',
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(allEnabledPreference);

      const result = await service.getEnabledChannels('user-123');

      expect(result).toEqual([
        NotificationChannel.EMAIL,
        NotificationChannel.IN_APP,
        NotificationChannel.SMS,
        NotificationChannel.DASHBOARD,
      ]);
    });

    it('should return only enabled channels', async () => {
      const partialPreference = {
        ...mockPreference,
        email_enabled: true,
        in_app_enabled: false,
        sms_enabled: false,
        dashboard_enabled: true,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(partialPreference);

      const result = await service.getEnabledChannels('user-123');

      expect(result).toEqual([NotificationChannel.EMAIL, NotificationChannel.DASHBOARD]);
    });

    it('should not include SMS when phone number is missing', async () => {
      const smsEnabledNoPhone = {
        ...mockPreference,
        sms_enabled: true,
        phone_number: null,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(smsEnabledNoPhone);

      const result = await service.getEnabledChannels('user-123');

      expect(result).not.toContain(NotificationChannel.SMS);
    });

    it('should return empty array when all channels disabled', async () => {
      const allDisabled = {
        ...mockPreference,
        email_enabled: false,
        in_app_enabled: false,
        sms_enabled: false,
        dashboard_enabled: false,
      };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(allDisabled);

      const result = await service.getEnabledChannels('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getDefaultChannel', () => {
    it('should return user default channel', async () => {
      const preference = { ...mockPreference, default_channel: NotificationChannel.IN_APP };
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(preference);

      const result = await service.getDefaultChannel('user-123');

      expect(result).toBe(NotificationChannel.IN_APP);
    });

    it('should return EMAIL when no preferences exist', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getDefaultChannel('user-123');

      expect(result).toBe(NotificationChannel.EMAIL);
    });
  });

  describe('getUserPhoneNumber', () => {
    it.each([
      ['SMS enabled with phone', { sms_enabled: true, phone_number: '+1234567890' }, '+1234567890'],
      ['SMS disabled with phone', { sms_enabled: false, phone_number: '+1234567890' }, null],
      ['SMS enabled without phone', { sms_enabled: true, phone_number: null }, null],
      ['no preferences', null, null],
    ])('should return correct value when %s', async (_description, preference, expected) => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(preference);

      const result = await service.getUserPhoneNumber('user-123');

      expect(result).toBe(expected);
      if (preference) {
        expect(prisma.userNotificationPreference.findUnique).toHaveBeenCalledWith({
          where: { user_id: 'user-123' },
          select: { phone_number: true, sms_enabled: true },
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long userId', async () => {
      const longUserId = 'a'.repeat(1000);
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);

      const result = await service.getUserPreferences(longUserId, 'tenant-123');

      expect(result).toBeDefined();
    });

    it('should handle special characters in phone number', async () => {
      const dto = {
        email_enabled: true,
        sms_enabled: true,
        phone_number: '+1 (555) 123-4567',
      };
      (prisma.userNotificationPreference.create as jest.Mock).mockResolvedValue({
        ...mockPreference,
        phone_number: dto.phone_number,
      });

      const result = await service.createPreferences('user-123', 'tenant-123', dto);

      expect(result.phone_number).toBe('+1 (555) 123-4567');
    });

    it('should handle concurrent preference updates', async () => {
      (prisma.userNotificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPreference);
      (prisma.userNotificationPreference.update as jest.Mock).mockResolvedValue(mockPreference);

      const updates = [
        service.updatePreferences('user-123', { email_enabled: true }),
        service.updatePreferences('user-123', { in_app_enabled: false }),
      ];

      const results = await Promise.all(updates);

      expect(results).toHaveLength(2);
      expect(prisma.userNotificationPreference.update).toHaveBeenCalledTimes(2);
    });
  });
});
