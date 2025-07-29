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
>>>>>>> aea5c90 (feat:auth)
