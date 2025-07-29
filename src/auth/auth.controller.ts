import { Controller, Post, Body, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit/auditLog.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    try {
      const result = await this.authService.login(body.username, body.password);
      await this.auditLogService.logAction({
        userId: result.user?.sub || 'unknown',
        tenantId: result.user?.tenantId || 'unknown',
        username: result.user?.username,
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'success',
      });
      return result;
    } catch (error) {
      await this.auditLogService.logAction({
        userId: 'unknown',
        tenantId: 'unknown',
        username: body.username,
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'failure',
        details: { error: error.message },
      });
      this.logger.warn(`Login failed for user ${body.username}: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
