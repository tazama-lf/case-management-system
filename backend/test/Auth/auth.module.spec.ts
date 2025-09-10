import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/auth/auth.controller';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';

describe('AuthModule', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should provide AuthService', () => {
    const authService = moduleRef.get<AuthService>(AuthService);
    expect(authService).toBeDefined();
  });

  it('should have AuthController', () => {
    const authController = moduleRef.get<AuthController>(AuthController);
    expect(authController).toBeDefined();
  });
});
