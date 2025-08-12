import { createParamDecorator, ExecutionContext } from '@nestjs/common';

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
export const User = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
<<<<<<< HEAD
=======
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
<<<<<<< HEAD
>>>>>>> aea5c90 (feat:auth)
=======
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
