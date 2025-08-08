import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Logger,
  Get,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit/auditLog.service';
import { User } from './user.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username: string; password: string }) {
    try {
      const result = await this.authService.login(body.username, body.password);
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'success',
      });
      return {
        message: 'Login successful',
        token: result.token,
      };
    } catch (error) {
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'failure',
        details: { error: error.message },
      });
      this.logger.warn(
        `Login failed for user ${body.username}: ${error.message}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@User() user: any) {
    return user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('audit-logs')
  async getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.auditLogService.getLogs(Number(limit), Number(offset));
  }
}
