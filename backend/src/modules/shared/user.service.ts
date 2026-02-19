import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface UserDetails {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

/**
 * Service for managing user-related operations.
 * Wraps AuthHelperService to provide simplified user data access with consistent error handling.
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Get user email address by user ID from Tazama auth-service
   * @param userId - The user ID to lookup
   * @returns User's email address or null if not found
   */
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const userDetails = await this.authService.getUserDetailsFromAuthService(userId);
      return userDetails.email;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get email for user ${userId}: ${errorMessage}`, UserService.name);
      return null;
    }
  }

  /**
   * Get full user details by user ID from Tazama auth-service
   * @param userId - The user ID to lookup
   * @returns UserDetails object or null if not found
   */
  async getUserDetails(userId: string): Promise<UserDetails | null> {
    try {
      const userDetails = await this.authService.getUserDetailsFromAuthService(userId);

      return {
        id: userDetails.id,
        username: userDetails.username,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        email: userDetails.email,
        roles: userDetails.roles,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get details for user ${userId}: ${errorMessage}`, UserService.name);
      return null;
    }
  }

  /**
   * Get user's full name by user ID from Tazama auth-service
   * @param userId
   * @returns
   */
  async getUserFullName(userId: string): Promise<string | null> {
    try {
      const userDetails = await this.authService.getUserDetailsFromAuthService(userId);
      return `${userDetails.firstName} ${userDetails.lastName}`.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get name for user ${userId}: ${errorMessage}`, UserService.name);
      return null;
    }
  }

  /**
   * Check if user exists in Tazama auth-service
   * Uses authHelperService.userExists() which leverages auth-lib
   * @param userId
   * @returns
   */
  async userExists(userId: string): Promise<boolean> {
    return await this.authService.userExists(userId);
  }

  /**
   * Batch get user emails for multiple user IDs from Tazama auth-service.
   * Useful for notification delivery to multiple users.
   * @param userIds
   * @returns
   */
  async getBatchUserEmails(userIds: string[]): Promise<Map<string, string>> {
    const emailMap = new Map<string, string>();

    // Process in parallel for better performance
    const emailPromises = userIds.map(async (userId) => {
      const email = await this.getUserEmail(userId);
      return { userId, email };
    });

    const results = await Promise.all(emailPromises);

    for (const { userId, email } of results) {
      if (email) {
        emailMap.set(userId, email);
      }
    }

    return emailMap;
  }

  /**
   * Batch get full user details for multiple user IDs from Tazama auth-service.
   * @param userIds
   * @returns
   */
  async getBatchUserDetails(userIds: string[]): Promise<Map<string, UserDetails>> {
    const detailsMap = new Map<string, UserDetails>();

    // Process in parallel for better performance
    const detailsPromises = userIds.map(async (userId) => {
      const details = await this.getUserDetails(userId);
      return { userId, details };
    });

    const results = await Promise.all(detailsPromises);

    for (const { userId, details } of results) {
      if (details) {
        detailsMap.set(userId, details);
      }
    }

    return detailsMap;
  }
}
