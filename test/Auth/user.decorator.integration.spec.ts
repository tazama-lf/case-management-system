import 'reflect-metadata';

let capturedFactory: (data: unknown, ctx: any) => any;

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    createParamDecorator: (factory: any) => {
      capturedFactory = factory;
      // return a no-op decorator function
      return () => undefined as any;
    },
  };
});

describe('User decorator integration (invokes actual factory)', () => {
  beforeAll(() => {
    // Import after mocking to capture the factory passed by user.decorator.ts
    jest.isolateModules(() => {
      require('../../src/auth/user.decorator');
    });
  });

  it('should extract request.user via captured factory', () => {
    expect(typeof capturedFactory).toBe('function');

    const mockUser = { id: 'u1', name: 'Test' };
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as any;

    const extracted = capturedFactory(undefined, mockCtx);
    expect(extracted).toEqual(mockUser);
  });

  it('should return undefined when request.user is missing', () => {
    expect(typeof capturedFactory).toBe('function');

    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;

    const extracted = capturedFactory(undefined, mockCtx);
    expect(extracted).toBeUndefined();
  });
});
