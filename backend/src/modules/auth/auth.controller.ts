import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { RequireAuthenticated } from '../../decorators/auth.decorator';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuthService } from './auth.service';
import { User } from '../../decorators/user.decorator';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import type { AuthenticatedUser } from '../../utils/types/auth.types';
import { AuthMeResponseDto } from 'src/modules/auth/dto/AuthMeResponse.dto';
import { LoginRequestDto } from 'src/modules/auth/dto/LoginRequest.dto';
import { LoginResponseDto } from 'src/modules/auth/dto/LoginResponse.dto';
import { CacheService } from '../shared/cache.service';
import { CacheService } from '../shared/cache.service';

@ApiTags('Auth')
@ApiBearerAuth('jwt')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate user', description: 'Authenticates a user and returns a JWT token.' })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ description: 'Login successful. JWT token returned.', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials supplied.' })
  async login(@Body() body: LoginRequestDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
  async login(@Body() body: LoginRequestDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    try {
      const result = await this.authService.login(body.username, body.password);

      // Decode JWT to extract userId (no verification needed, just reading the payload)
      const decoded = jwt.decode(result.token) as { clientId?: string; sub?: string } | null;
      this.logger.log(`Decoded JWT payload: ${JSON.stringify(decoded)}`);
      const userId = decoded?.clientId ?? decoded?.sub ?? 'unknown';

      this.logger.log(`User logged in: ${userId}`);

      // Set JWT as HttpOnly cookie for iframe authentication (Voila proxy)
      // This allows iframes to send the token automatically via cookies
      res.cookie(`access_token_${userId}`, result.token, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'lax', // Allows cookie with same-site iframe requests
        maxAge: result.expiresIn ? result.expiresIn * 1000 : 24 * 60 * 60 * 1000, // Convert to ms
        path: '/',
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
    const firstName = user.actorName ? user.actorName.split(' ')[0] : '';
    const lastName = user.actorName ? user.actorName.split(' ').slice(1).join(' ') : '';

    return {
      clientId: user.userId,
      tenantId: user.tenantId,
      email: user.actorEmail ?? '',
      firstName,
      lastName,
      fullName: user.actorName ?? '',
      tenantName: user.tenantName,
      validatedClaims: user.validated,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(TazamaAuthGuard)
  @ApiOperation({ summary: 'Logout user', description: 'Clears the access_token cookie and cached JWT token.' })
  @ApiOkResponse({ description: 'Logout successful.' })
  @ApiBearerAuth('jwt')
  async logout(@Res({ passthrough: true }) res: Response, @User() user: AuthenticatedUser): Promise<{ message: string }> {
    const userId = user.userId || 'unknown';

    // Clear the HttpOnly cookie
    res.clearCookie(`access_token_${userId}`, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    // Clear the cached JWT token from Redis
    await this.cacheService.deleteUserToken(userId);

    return { message: 'Logout successful' };
  }
}
