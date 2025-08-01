import { Roles } from '../../src/auth/roles.decorator';
import { SetMetadata } from '@nestjs/common';

// Mock SetMetadata
<<<<<<< HEAD
jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    SetMetadata: jest.fn(),
  };
});

describe('Roles Decorator', () => {
  const mockSetMetadata = SetMetadata as jest.MockedFunction<
    typeof SetMetadata
  >;
=======
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  SetMetadata: jest.fn(),
}));

describe('Roles Decorator', () => {
  const mockSetMetadata = SetMetadata as jest.MockedFunction<typeof SetMetadata>;
>>>>>>> 68856f4 (feat: Test Coverage)

  beforeEach(() => {
    mockSetMetadata.mockClear();
  });

  it('should be defined', () => {
    expect(Roles).toBeDefined();
  });

  it('should call SetMetadata with roles key and provided roles', () => {
    const testRoles = ['admin', 'user'];
<<<<<<< HEAD

    Roles(...testRoles);

=======
    
    Roles(...testRoles);
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', testRoles);
    expect(mockSetMetadata).toHaveBeenCalledTimes(1);
  });

  it('should handle single role', () => {
    const singleRole = 'admin';
<<<<<<< HEAD

    Roles(singleRole);

=======
    
    Roles(singleRole);
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', [singleRole]);
  });

  it('should handle multiple roles', () => {
    const multipleRoles = ['admin', 'user', 'moderator'];
<<<<<<< HEAD

    Roles(...multipleRoles);

=======
    
    Roles(...multipleRoles);
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', multipleRoles);
  });

  it('should handle empty roles array', () => {
    Roles();
<<<<<<< HEAD

=======
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', []);
  });

  it('should handle duplicate roles', () => {
    const rolesWithDuplicates = ['admin', 'user', 'admin'];
<<<<<<< HEAD

    Roles(...rolesWithDuplicates);

=======
    
    Roles(...rolesWithDuplicates);
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', rolesWithDuplicates);
  });
});
