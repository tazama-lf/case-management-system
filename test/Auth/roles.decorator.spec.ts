import { Roles } from '../../src/auth/roles.decorator';
import { SetMetadata } from '@nestjs/common';

// Mock SetMetadata
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  SetMetadata: jest.fn(),
}));

describe('Roles Decorator', () => {
  const mockSetMetadata = SetMetadata as jest.MockedFunction<typeof SetMetadata>;

  beforeEach(() => {
    mockSetMetadata.mockClear();
  });

  it('should be defined', () => {
    expect(Roles).toBeDefined();
  });

  it('should call SetMetadata with roles key and provided roles', () => {
    const testRoles = ['admin', 'user'];
    
    Roles(...testRoles);
    
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', testRoles);
    expect(mockSetMetadata).toHaveBeenCalledTimes(1);
  });

  it('should handle single role', () => {
    const singleRole = 'admin';
    
    Roles(singleRole);
    
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', [singleRole]);
  });

  it('should handle multiple roles', () => {
    const multipleRoles = ['admin', 'user', 'moderator'];
    
    Roles(...multipleRoles);
    
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', multipleRoles);
  });

  it('should handle empty roles array', () => {
    Roles();
    
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', []);
  });

  it('should handle duplicate roles', () => {
    const rolesWithDuplicates = ['admin', 'user', 'admin'];
    
    Roles(...rolesWithDuplicates);
    
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', rolesWithDuplicates);
  });
});
