import { AuthModule } from '../../src/auth/auth.module';
import { AuthService } from '../../src/auth/auth.service';
import { AuthController } from '../../src/auth/auth.controller';
import { JwtStrategy } from '../../src/auth/jwt.strategy';

describe('AuthModule', () => {
  it('should be defined', () => {
    expect(AuthModule).toBeDefined();
  });

  it('should have correct module configuration', () => {
    const providersMetadata = Reflect.getMetadata('providers', AuthModule);
    const controllersMetadata = Reflect.getMetadata('controllers', AuthModule);
    const exportsMetadata = Reflect.getMetadata('exports', AuthModule);
<<<<<<< HEAD

=======
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(providersMetadata).toContain(AuthService);
    expect(providersMetadata).toContain(JwtStrategy);
    expect(controllersMetadata).toContain(AuthController);
    expect(exportsMetadata).toContain(AuthService);
    expect(exportsMetadata).toContain(JwtStrategy);
  });

  it('should import required modules', () => {
    const moduleMetadata = Reflect.getMetadata('imports', AuthModule);
    expect(moduleMetadata).toBeDefined();
    expect(Array.isArray(moduleMetadata)).toBe(true);
    expect(moduleMetadata.length).toBeGreaterThan(0);
  });
});
