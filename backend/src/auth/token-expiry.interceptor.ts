import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class TokenExpiryInterceptor implements NestInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (token) {
      const isExpired = (this.authService as any)['isTokenExpired'](token);
      if (isExpired) {
        throw new UnauthorizedException(
          'Token has expired. Please log in again.',
        );
      }
    }

    return next.handle().pipe(
      catchError((error) => {
        if (error.status === 401 && token) {
          const isExpired = (this.authService as any)['isTokenExpired'](token);
          if (isExpired) {
            return throwError(
              () =>
                new UnauthorizedException(
                  'Token has expired. Please log in again.',
                ),
            );
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
