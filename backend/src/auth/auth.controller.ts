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
import { RequireSupervisorRole } from './auth.decorator';
import { AuthHelperService, AuthUser } from './auth-helper.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit/auditLog.service';
import { User } from './user.decorator';
import { TazamaAuthGuard } from './tazama-auth.guard';
import { Outcome } from 'src/audit/types/outcome';
import type { AuthenticatedUser, AuthenticatedRequest } from './auth.types';

class AuthUserResponseDto {
  @ApiProperty({ example: 'c98db341-beb6-457c-98e0-406cc1c71662' })
  id!: string;

  @ApiProperty({ example: 'karen.mworia' })
  username!: string;

  @ApiProperty({ example: 'Karen' })
  firstName!: string;

  @ApiProperty({ example: 'Mworia' })
  lastName!: string;

  @ApiProperty({ example: 'karen.mworia@cms.org' })
  email!: string;

  @ApiProperty({ type: [String], example: ['CMS_INVESTIGATOR'] })
  roles!: string[];
}

class UserRolesResponseDto {
  @ApiProperty({ type: [String], example: ['CMS_ADMIN', 'CMS_SUPERVISOR'] })
  roles!: string[];
}

class LoginRequestDto {
  @ApiProperty({ example: 'admin' })
  username!: string;

  @ApiProperty({ example: 'admin' })
  password!: string;
}

class LoginResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token!: string;

  @ApiProperty({ example: 3600, required: false, nullable: true })
  expiresIn!: number | null | undefined;
}

class AuthMeResponseDto {
  @ApiProperty({ example: '085b7a75-c39d-44f8-868f-6c419f578627' })
  clientId!: string;

  @ApiProperty({ example: 'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1', nullable: true })
  tenantId!: string | null;

  @ApiProperty({ example: 'admin', nullable: true })
  username!: string | null;

  @ApiProperty({ example: 'admin@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: 'Admin', nullable: true })
  firstName!: string | null;

  @ApiProperty({ example: 'Admin', nullable: true })
  lastName!: string | null;

  @ApiProperty({ example: 'Admin Admin', nullable: true })
  fullName!: string | null;

  @ApiProperty({ example: '085b7a75-c39d-44f8-868f-6c419f578627', nullable: true })
  subject!: string | null;

  @ApiProperty({ example: 'http://10.10.80.33:8080/realms/tazama-cms', nullable: true })
  issuer!: string | null;

  @ApiProperty({ type: [String], example: ['CMS_ADMIN', 'CMS_SUPERVISOR'] })
  claims!: string[];

  @ApiProperty({ type: [String], example: ['CMS_SUPERVISOR'] })
  validClaims!: string[];

  @ApiProperty({ example: 1762083870, nullable: true })
  expiresAt!: number | null;

  @ApiProperty({ example: 1762082970, nullable: true })
  issuedAt!: number | null;
}

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

  @UseGuards(TazamaAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Authenticated user details', description: 'Returns the authenticated user payload from the access token.' })
  @ApiOkResponse({ description: 'Authenticated user information returned successfully.', type: AuthMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
  getMe(@User() user: AuthenticatedUser): AuthMeResponseDto {
    const { token, validClaims } = user;
    return {
      clientId: token.clientId,
      tenantId: token.tenantId ?? null,
      username: token.preferredUsername ?? null,
      email: token.email ?? null,
      firstName: token.firstName ?? null,
      lastName: token.lastName ?? null,
      fullName: token.fullName ?? null,
      subject: token.subject ?? null,
      issuer: token.issuer ?? null,
      claims: token.claims,
      validClaims,
      expiresAt: token.expiresAt ?? null,
      issuedAt: token.issuedAt ?? null,
    };
  }

  @UseGuards(TazamaAuthGuard)
  @Get('user/userrole')
  @ApiOperation({ summary: 'Fetch authenticated user roles', description: 'Returns the realm roles assigned to the authenticated user.' })
  @ApiOkResponse({ description: 'Realm roles for the authenticated user.', type: UserRolesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token.' })
  getAuthenticatedUserRoles(@User() user: AuthenticatedUser): UserRolesResponseDto {
    const roles = Array.from(new Set(user.token.realmRoles ?? []));
    return { roles };
  }

  @RequireSupervisorRole()
  @UseGuards(TazamaAuthGuard)
  @Get('user/:roleName')
  @ApiOperation({
    summary: 'Fetch users by role',
    description: 'Returns all users assigned to the provided role name.',
  })
  @ApiOkResponse({ description: 'List of users for the requested role returned successfully.', type: AuthUserResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token or insufficient claims.' })
  async getUsersByRole(@Param('roleName') roleName: string, @Req() req: AuthenticatedRequest): Promise<AuthUserResponseDto[]> {
    const normalizedRole = roleName.trim();
    this.logger.log(`Fetching users with role ${normalizedRole}`, AuthController.name);

    // Extract token from request header to pass to auth-service
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const users = await this.authHelperService.getAllUsersWithRole(normalizedRole, token);

    return users.map((userObj) => this.mapAuthUser(userObj));
  }

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

  private mapAuthUser(user: AuthUser): AuthUserResponseDto {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: [...user.roles],
    };
  }
}
