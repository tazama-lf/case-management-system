import { Controller, Post, Body, UnauthorizedException, Get, UseGuards, HttpCode, Query, ForbiddenException } from '@nestjs/common';
import { RequireSupervisorRole } from './auth.decorator';
import { AuthHelperService } from './auth-helper.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit/auditLog.service';
import { User } from './user.decorator';
import { TazamaAuthGuard } from './tazama-auth.guard';
import { Outcome } from 'src/audit/types/outcome';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
    private readonly authHelperService: AuthHelperService,
  ) {}

  @RequireSupervisorRole()
  @UseGuards(TazamaAuthGuard)
  @Get('investigators')
  async getInvestigators(@User() user: any): Promise<any[]> {
    // Gracefully handle missing supervisor claim (should not occur due to guard)
    if (!user?.token?.claims?.includes('CMS_SUPERVISOR')) {
      return [];
    }
    const {
      AUTH_URL,
      KEYCLOAK_REALM,
      CLIENT_ID,
      CLIENT_SECRET,
    } = process.env;
    if (!AUTH_URL || !KEYCLOAK_REALM || !CLIENT_ID || !CLIENT_SECRET) {
      return [];
    }
    // Use a helper method to fetch all users from Keycloak
    const users = await this.authHelperService.getAllUsersWithRole('CMS_INVESTIGATOR');
    return users.map(userObj => ({
      id: userObj.id,
      username: userObj.username,
      email: userObj.email,
      firstName: userObj.firstName,
      lastName: userObj.lastName,
    }));
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username: string; password: string }) {
    try {
      this.logger.log(`Attempting login for user ${body.username}`);
      const result = await this.authService.login(body.username, body.password);
      this.logger.log(`User ${JSON.stringify(result)} logged in successfully`);
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: Outcome.SUCCESS,
      });
      const response: any = {
        message: 'Login successful',
        token: result.token,
      };
      if (result.expiresIn) {
        response.expiresIn = result.expiresIn;
      }
      return response;
    } catch (error) {
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: Outcome.FAILURE,
      });
      this.logger.warn(`Login failed for user ${body.username}: ${error.message}`, AuthController.name);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @UseGuards(TazamaAuthGuard)
  @Get('me')
  getMe(@User() user: any) {
    return user;
  }

  @UseGuards(TazamaAuthGuard)
  @Get('audit-logs')
  async getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.auditLogService.getLogs(Number(limit), Number(offset));
  }
}
