import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
<<<<<<< HEAD
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
=======
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
>>>>>>> 61c1161 (feat: Auth adding roles decorators)
