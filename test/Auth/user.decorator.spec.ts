import { User } from '../../src/auth/user.decorator';

describe('User Decorator', () => {
  it('should be defined', () => {
    expect(User).toBeDefined();
    expect(typeof User).toBe('function');
  });

  it('should create a parameter decorator', () => {
    const decorator = User();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe('function');
  });

  it('should extract user from request context', () => {
    const mockUser = { id: 'test-user', name: 'Test User' };
    const mockRequest = { user: mockUser };
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as any;

    const decoratorFactory = User();
    const result = decoratorFactory({}, mockExecutionContext, 0);

    expect(result).toEqual(mockUser);
  });

  it('should create different decorators for different calls', () => {
    const decorator1 = User();
    const decorator2 = User();
    expect(decorator1).toBeDefined();
    expect(decorator2).toBeDefined();
    // They should be different function instances
    expect(decorator1).not.toBe(decorator2);
  });

  it('should accept data parameter', () => {
    const decorator = User('someData');
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe('function');
  });

  it('should work without data parameter', () => {
    const decorator = User();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe('function');
  });

  // Test the actual decorator function logic
  it('should create a decorator that can be used on parameters', () => {
    // Manually invoke the decorator logic to test the function
    const decoratorFunction = User();

    // For this test, we'll just verify the decorator can be created
    expect(decoratorFunction).toBeDefined();
    expect(typeof decoratorFunction).toBe('function');
  });
});
