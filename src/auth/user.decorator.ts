import { createParamDecorator, ExecutionContext } from '@nestjs/common';

<<<<<<< HEAD
export const User = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
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
