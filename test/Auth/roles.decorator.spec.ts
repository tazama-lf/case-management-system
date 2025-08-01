import { Roles } from '../../src/auth/roles.decorator';
import { SetMetadata } from '@nestjs/common';

// Mock SetMetadata
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    SetMetadata: jest.fn(),
  };
});
<<<<<<< HEAD

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
=======

describe('Roles Decorator', () => {
  const mockSetMetadata = SetMetadata as jest.MockedFunction<
    typeof SetMetadata
  >;
>>>>>>> 0d032a5 (feat:Test to Triage Module)

  beforeEach(() => {
    mockSetMetadata.mockClear();
  });

  it('should be defined', () => {
    expect(Roles).toBeDefined();
  });

  it('should call SetMetadata with roles key and provided roles', () => {
    const testRoles = ['admin', 'user'];
<<<<<<< HEAD
<<<<<<< HEAD

    Roles(...testRoles);

=======
    
    Roles(...testRoles);
    
>>>>>>> 68856f4 (feat: Test Coverage)
=======

    Roles(...testRoles);

>>>>>>> 0d032a5 (feat:Test to Triage Module)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', testRoles);
    expect(mockSetMetadata).toHaveBeenCalledTimes(1);
  });

  it('should handle single role', () => {
    const singleRole = 'admin';
<<<<<<< HEAD
<<<<<<< HEAD

    Roles(singleRole);

=======
    
    Roles(singleRole);
    
>>>>>>> 68856f4 (feat: Test Coverage)
=======

    Roles(singleRole);

>>>>>>> 0d032a5 (feat:Test to Triage Module)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', [singleRole]);
  });

  it('should handle multiple roles', () => {
    const multipleRoles = ['admin', 'user', 'moderator'];
<<<<<<< HEAD
<<<<<<< HEAD

    Roles(...multipleRoles);

=======
    
    Roles(...multipleRoles);
    
>>>>>>> 68856f4 (feat: Test Coverage)
=======

    Roles(...multipleRoles);

>>>>>>> 0d032a5 (feat:Test to Triage Module)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', multipleRoles);
  });

  it('should handle empty roles array', () => {
    Roles();
<<<<<<< HEAD
<<<<<<< HEAD

=======
    
>>>>>>> 68856f4 (feat: Test Coverage)
=======

>>>>>>> 0d032a5 (feat:Test to Triage Module)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', []);
  });

  it('should handle duplicate roles', () => {
    const rolesWithDuplicates = ['admin', 'user', 'admin'];
<<<<<<< HEAD
<<<<<<< HEAD

    Roles(...rolesWithDuplicates);

=======
    
    Roles(...rolesWithDuplicates);
    
>>>>>>> 68856f4 (feat: Test Coverage)
=======

    Roles(...rolesWithDuplicates);

>>>>>>> 0d032a5 (feat:Test to Triage Module)
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', rolesWithDuplicates);
  });
});
