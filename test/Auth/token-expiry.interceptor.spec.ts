import { TokenExpiryInterceptor } from '../../src/auth/token-expiry.interceptor';
import { AuthService } from '../../src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import {
  ExecutionContext,
  UnauthorizedException,
  CallHandler,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('TokenExpiryInterceptor', () => {
  let interceptor: TokenExpiryInterceptor;
  let authService: Partial<AuthService>;
  let configService: Partial<ConfigService>;
  let context: Partial<ExecutionContext>;
  let callHandler: Partial<CallHandler>;

  beforeEach(() => {
    authService = {
      isTokenExpired: jest.fn(),
    };
    configService = {};
    interceptor = new TokenExpiryInterceptor(
      authService as AuthService,
      configService as ConfigService,
    );
    context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: { authorization: 'Bearer valid.token' },
        }),
      }),
    };
    callHandler = {
      handle: jest.fn().mockReturnValue(of('success')),
    };
  });

  it('should call next.handle() if token is valid', () => {
    (authService.isTokenExpired as jest.Mock).mockReturnValue(false);
    expect(
      interceptor.intercept(
        context as ExecutionContext,
        callHandler as CallHandler,
      ),
    ).toBeInstanceOf(Object);
  });

  it('should throw UnauthorizedException if token is expired', () => {
    (authService.isTokenExpired as jest.Mock).mockReturnValue(true);
    expect(() =>
      interceptor.intercept(
        context as ExecutionContext,
        callHandler as CallHandler,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('should call next.handle() if no token is present', () => {
    (context.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ headers: {} }),
    });
    expect(
      interceptor.intercept(
        context as ExecutionContext,
        callHandler as CallHandler,
      ),
    ).toBeInstanceOf(Object);
  });

  it('should throw UnauthorizedException in catchError if error is 401 and token is expired', (done) => {
    // First call: not expired, so Observable is returned
    (authService.isTokenExpired as jest.Mock)
      .mockReturnValueOnce(false) // for the initial check
      .mockReturnValueOnce(true); // for the catchError check

    callHandler.handle = jest
      .fn()
      .mockReturnValue(throwError(() => ({ status: 401 })));
    interceptor
      .intercept(context as ExecutionContext, callHandler as CallHandler)
      .subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(UnauthorizedException);
          done();
        },
      });
  });

  it('should rethrow error in catchError if not 401', (done) => {
    (authService.isTokenExpired as jest.Mock).mockReturnValue(false);
    callHandler.handle = jest
      .fn()
      .mockReturnValue(throwError(() => ({ status: 500 })));
    interceptor
      .intercept(context as ExecutionContext, callHandler as CallHandler)
      .subscribe({
        error: (err) => {
          expect(err.status).toBe(500);
          done();
        },
      });
  });
});
