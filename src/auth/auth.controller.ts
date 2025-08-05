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
  BadRequestException,
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
      const response: any = {
        message: 'Login successful',
        token: result.token,
      };
      if (result.refreshToken) {
        response.refreshToken = result.refreshToken;
      }
      if (result.expiresIn) {
        response.expiresIn = result.expiresIn;
      }
      if (result.token) {
        // Optionally, you can keep expiry info if needed for frontend
        // const expiry = await this.authService.getTokenExpiry(result.token);
        // if (expiry) {
        //   response.expiresAt = expiry.toISOString();
        // }
      }
      return response;
    } catch (error) {
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'failure',
      });
      this.logger.warn(
        `Login failed for user ${body.username}: ${error.message}`,
      );
      this.logger.warn(
        `Login failed for user ${body.username}: ${error.message}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refreshToken(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    try {
      const result = await this.authService.refreshToken(body.refreshToken);
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'token_refresh',
        entityName: 'user',
        actionPerformed: 'refresh_token',
        outcome: 'success',
      });
      const response: any = {
        message: 'Token refresh successful',
        token: result.token,
      };
      if (result.refreshToken) {
        response.refreshToken = result.refreshToken;
      }
      if (result.expiresIn) {
        response.expiresIn = result.expiresIn;
      }
      // Optionally, you can keep expiry info if needed for frontend
      // if (result.token) {
      //   const expiry = await this.authService.getTokenExpiry(result.token);
      //   if (expiry) {
      //     response.expiresAt = expiry.toISOString();
      //   }
      // }
      return response;
    } catch (error) {
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'token_refresh',
        entityName: 'user',
        actionPerformed: 'refresh_token',
        outcome: 'failure',
      });
      this.logger.warn(`Token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Token refresh failed');
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
  async getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.auditLogService.getLogs(Number(limit), Number(offset));
  }
}
