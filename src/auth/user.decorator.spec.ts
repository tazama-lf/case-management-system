import { ExecutionContext } from '@nestjs/common';
import { User } from './user.decorator';

describe('User Decorator', () => {
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    } as any;
  });

  it('should extract user from request', () => {
    const mockUser = {
      user_id: 'user-123',
      tenantId: 'tenant-456',
      role: ['admin'],
      permissions: ['read', 'write'],
    };

    const mockRequest = { user: mockUser };
    
    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    // The User decorator is created by createParamDecorator, so we need to get the factory function
    const decoratorFactory = User as any;
    const result = decoratorFactory.factory(undefined, mockExecutionContext);

    expect(result).toEqual(mockUser);
    expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    expect(mockExecutionContext.switchToHttp().getRequest).toHaveBeenCalled();
  });

  it('should return undefined when no user in request', () => {
    const mockRequest = {};
    
    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    const decoratorFactory = User as any;
    const result = decoratorFactory.factory(undefined, mockExecutionContext);

    expect(result).toBeUndefined();
  });

  it('should return null when user is explicitly null', () => {
    const mockRequest = { user: null };
    
    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    const decoratorFactory = User as any;
    const result = decoratorFactory.factory(undefined, mockExecutionContext);

    expect(result).toBeNull();
  });

  it('should handle complex user objects', () => {
    const mockUser = {
      user_id: 'user-123',
      tenantId: 'tenant-456',
      role: ['admin', 'moderator'],
      permissions: ['read', 'write', 'delete'],
      username: 'testuser',
      email: 'test@example.com',
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
      metadata: {
        lastLogin: new Date(),
        loginCount: 5,
      },
    };

    const mockRequest = { user: mockUser };
    
    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    const decoratorFactory = User as any;
    const result = decoratorFactory.factory(undefined, mockExecutionContext);

    expect(result).toEqual(mockUser);
    expect(result.profile.firstName).toBe('Test');
    expect(result.metadata.loginCount).toBe(5);
  });

  it('should ignore data parameter', () => {
    const mockUser = { user_id: 'user-123' };
    const mockRequest = { user: mockUser };
    
    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    const decoratorFactory = User as any;
    const result = decoratorFactory.factory('someData', mockExecutionContext);

    // The decorator ignores the data parameter in current implementation
    expect(result).toEqual(mockUser);
  });
});
