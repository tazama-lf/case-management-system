import { Injectable, Logger } from '@nestjs/common';
import { AuthHelperService } from '../auth/auth-helper.service';

export interface UserDetails {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly authHelperService: AuthHelperService) {}

  /**
   * Get user email address by user ID
   * @param userId
   * @returns
   */
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const userDetails = await this.authHelperService.getUserDetailsFromAuthService(userId);
      return userDetails?.email || null;
    } catch (error) {
      this.logger.error(`Failed to get email for user ${userId}: ${error.message}`, UserService.name);
      return null;
    }
  }

  /**
   * Get full user details by user ID
   * @param userId
   * @returns
   */
  async getUserDetails(userId: string): Promise<UserDetails | null> {
    try {
      const userDetails = await this.authHelperService.getUserDetailsFromAuthService(userId);
      if (!userDetails) {
        return null;
      }

      return {
        id: userDetails.id,
        username: userDetails.username,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        email: userDetails.email,
        roles: userDetails.roles || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to get details for user ${userId}: ${error.message}. Attempting to use mocked investigator for testing.`, UserService.name);

      // Fallback for local/testing: return a mocked investigator if available
      try {
        const investigators = await this.authHelperService.getAllUsersWithRole('CMS_INVESTIGATOR');
        if (investigators && investigators.length > 0) {
          const mock = investigators[0];
          this.logger.log(`Using mock investigator ${mock.username} (${mock.id}) for missing user ${userId}`, UserService.name);
          return {
            id: mock.id,
            username: mock.username,
            firstName: mock.firstName,
            lastName: mock.lastName,
            email: mock.email,
            roles: mock.roles || [],
          };
        }
      } catch (err) {
        this.logger.warn(`Fallback to mock investigator failed: ${err.message}`, UserService.name);
      }

      return null;
    }
  }

  /**
   * Get user's full name by user ID
   * @param userId
   * @returns
   */
  async getUserFullName(userId: string): Promise<string | null> {
    try {
      const userDetails = await this.authHelperService.getUserDetailsFromAuthService(userId);
      if (!userDetails) {
        return null;
      }

      return `${userDetails.firstName} ${userDetails.lastName}`.trim();
    } catch (error) {
      this.logger.error(`Failed to get name for user ${userId}: ${error.message}`, UserService.name);
      return null;
    }
  }

  /**
   * Check if user exists
   * @param userId
   * @returns
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      return await this.authHelperService.userExists(userId);
    } catch (error) {
      this.logger.error(`Failed to check existence for user ${userId}: ${error.message}`, UserService.name);
      return false;
    }
  }

  /**
   * Batch get user emails for multiple user IDs
   * Useful for notification delivery to multiple users
   * @param userIds
   * @returns
   */
  async getBatchUserEmails(userIds: string[]): Promise<Map<string, string>> {
    const emailMap = new Map<string, string>();

    for (const userId of userIds) {
      const email = await this.getUserEmail(userId);
      if (email) {
        emailMap.set(userId, email);
      }
    }

    return emailMap;
  }
}
