import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequireAuthenticated } from './auth.decorator';
import { AuthHelperService, AuthUser } from './auth-helper.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit/auditLog.service';
import { User } from './user.decorator';
import { TazamaAuthGuard } from './tazama-auth.guard';
import { Outcome } from 'src/modules/audit/types/outcome';
import type { AuthenticatedUser } from './auth.types';
import { AuthMeResponseDto, AuthUserResponseDto, LoginRequestDto, LoginResponseDto } from './dto';

@ApiTags('Auth')
@ApiBearerAuth('jwt')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
    private readonly authHelperService: AuthHelperService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate user', description: 'Authenticates a user and returns a JWT token.' })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ description: 'Login successful. JWT token returned.', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials supplied.' })
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    try {
      this.logger.log(`Attempting login for user ${body.username}`);
      const result = await this.authService.login(body.username, body.password);
      this.logger.log(`User ${body.username} logged in successfully`);
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: Outcome.SUCCESS,
      });
      const response: LoginResponseDto = {
        message: 'Login successful',
        token: result.token,
        expiresIn: result.expiresIn ?? undefined,
      };
      if (result.expiresIn === null) {
        response.expiresIn = null;
      }
      return response;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown login error');
      await this.auditLogService.logAction({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: Outcome.FAILURE,
      });
      this.logger.warn(`Login failed for user ${body.username}: ${err.message}`, AuthController.name);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Get('me')
  @UseGuards(TazamaAuthGuard)
  @ApiOperation({ summary: 'Authenticated user details', description: 'Returns the authenticated user payload from the access token.' })
  @ApiOkResponse({ description: 'Authenticated user information returned successfully.', type: AuthMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
  @RequireAuthenticated()
  getMe(@User() user: AuthenticatedUser): AuthMeResponseDto {
    const { token, validatedClaims } = user;
    return {
      clientId: token.clientId,
      tenantId: token.tenantId,
      email: token.email,
      firstName: token.firstName,
      lastName: token.lastName,
      fullName: token.fullName,
      tenantName: token.tenantName,
      validatedClaims,
    };
  }

  // @UseGuards(TazamaAuthGuard)
  // @Get('user/userrole')
  // @ApiOperation({ summary: 'Fetch authenticated user roles', description: 'Returns the realm roles assigned to the authenticated user.' })
  // @ApiOkResponse({ description: 'Realm roles for the authenticated user.', type: UserRolesResponseDto })
  // @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
  // getAuthenticatedUserRoles(@User() user: AuthenticatedUser): UserRolesResponseDto {
  //   const roles = Array.from(new Set(user.token.realmRoles ?? []));
  //   return { roles };
  // }

  // @RequireSupervisorRole()
  // @UseGuards(TazamaAuthGuard)
  // @Get('user/:roleName')
  // @ApiOperation({
  //   summary: 'Fetch users by role',
  //   description: 'Returns all users assigned to the provided role name.',
  // })
  // @ApiOkResponse({ description: 'List of users for the requested role returned successfully.', type: AuthUserResponseDto, isArray: true })
  // @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token or insufficient claims.' })
  // async getUsersByRole(@Param('roleName') roleName: string, @Req() req: AuthenticatedRequest): Promise<AuthUserResponseDto[]> {
  //   const normalizedRole = roleName.trim();
  //   this.logger.log(`Fetching users with role ${normalizedRole}`, AuthController.name);

  //   // Extract token from request header to pass to auth-service
  //   const authHeader = req.headers.authorization;
  //   const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  //   const users = await this.authHelperService.getAllUsersWithRole(normalizedRole, token);

  //   return users.map((userObj) => this.mapAuthUser(userObj));
  // }

  @UseGuards(TazamaAuthGuard)
  @Get('audit-logs')
  @ApiOperation({ summary: 'Fetch audit logs', description: 'Returns audit logs with pagination support.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of audit log entries to return.',
    schema: { type: 'integer', default: 50 },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of entries to skip before collecting results.',
    schema: { type: 'integer', default: 0 },
  })
  @ApiOkResponse({ description: 'Audit log entries returned successfully.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
  async getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.auditLogService.getLogs(Number(limit), Number(offset));
  }

  // private mapAuthUser(user: AuthUser): AuthUserResponseDto {
  //   return {
  //     id: user.id,
  //     username: user.username,
  //     firstName: user.firstName,
  //     lastName: user.lastName,
  //     email: user.email,
  //     roles: [...user.roles],
  //   };
  // }
}
