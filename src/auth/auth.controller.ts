<<<<<<< HEAD
import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Logger,
  LoggerService,
  Get,
  UseGuards,
  HttpCode,
  Query,
  Inject,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit/auditLog.service';
import { User } from './user.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    @Inject(Logger) private readonly logger: LoggerService,
  ) {}

  @Post('login')
  @HttpCode(200)
=======
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
>>>>>>> d139c1c (feat:auth)
  async login(@Body() body: { username: string; password: string }) {
    try {
      const result = await this.authService.login(body.username, body.password);
      await this.auditLogService.logAction({
<<<<<<< HEAD
        userId: 'unknown',
=======
        userId: result.user?.sub || 'unknown',
        tenantId: result.user?.tenantId || 'unknown',
        username: result.user?.username,
>>>>>>> d139c1c (feat:auth)
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'success',
      });
<<<<<<< HEAD
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
=======
      return result;
    } catch (error) {
      await this.auditLogService.logAction({
        userId: 'unknown',
        tenantId: 'unknown',
        username: body.username,
>>>>>>> d139c1c (feat:auth)
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'failure',
<<<<<<< HEAD
=======
        details: { error: error.message },
>>>>>>> d139c1c (feat:auth)
      });
      this.logger.warn(`Login failed for user ${body.username}: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
<<<<<<< HEAD

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
=======
>>>>>>> d139c1c (feat:auth)
}
