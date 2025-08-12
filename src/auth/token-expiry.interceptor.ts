<<<<<<< HEAD
<<<<<<< HEAD
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
=======
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
=======
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
import { ConfigService } from '@nestjs/config';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class TokenExpiryInterceptor implements NestInterceptor {
<<<<<<< HEAD
<<<<<<< HEAD
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}
=======
  private readonly refreshThreshold: number;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.refreshThreshold = parseInt(
      this.configService.get<string>('TOKEN_REFRESH_THRESHOLD') || '300',
      10,
    );
  }
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
=======
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}
>>>>>>> a67b513 (feat: token refresh functionality implemented)

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (token) {
      const isExpired = (this.authService as any)['isTokenExpired'](token);
<<<<<<< HEAD
<<<<<<< HEAD
      if (isExpired) {
        throw new UnauthorizedException('Token has expired. Please log in again.');
=======
      const timeToExpiry = (this.authService as any)['getTokenTimeToExpiry'](
        token,
      );
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      if (isExpired) {
        throw new UnauthorizedException('Token has expired. Please log in again.');
      }
<<<<<<< HEAD
      if (timeToExpiry < this.refreshThreshold && timeToExpiry > 0) {
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-Token-Refresh-Required', 'true');
        response.setHeader('X-Token-Expires-In', timeToExpiry.toString());
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
      }
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    }

    return next.handle().pipe(
      catchError((error) => {
        if (error.status === 401 && token) {
          const isExpired = (this.authService as any)['isTokenExpired'](token);
          if (isExpired) {
<<<<<<< HEAD
<<<<<<< HEAD
            return throwError(() => new UnauthorizedException('Token has expired. Please log in again.'));
=======
            return throwError(
              () =>
                new UnauthorizedException(
                  'Token has expired. Please log in again.',
                ),
            );
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
=======
            return throwError(() => new UnauthorizedException('Token has expired. Please log in again.'));
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
          }
        }
        return throwError(() => error);
      }),
    );
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
