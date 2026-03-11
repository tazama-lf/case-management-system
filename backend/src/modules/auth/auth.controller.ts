import { Body, Controller, Get, HttpCode, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { RequireAuthenticated } from '../../decorators/auth.decorator';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuthService } from './auth.service';
import { User } from '../../decorators/user.decorator';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import type { AuthenticatedUser } from '../../utils/types/auth.types';
import { AuthMeResponseDto } from 'src/modules/auth/dto/AuthMeResponse.dto';
import { LoginRequestDto } from 'src/modules/auth/dto/LoginRequest.dto';
import { LoginResponseDto } from 'src/modules/auth/dto/LoginResponse.dto';

@ApiTags('Auth')
@ApiBearerAuth('jwt')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate user', description: 'Authenticates a user and returns a JWT token.' })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ description: 'Login successful. JWT token returned.', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials supplied.' })
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    try {
      const result = await this.authService.login(body.username, body.password);
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
}
