<<<<<<< HEAD
<<<<<<< HEAD
import { Logger } from '@nestjs/common';
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
=======
import { Logger } from '@nestjs/common';
>>>>>>> f74fb43 (feat: token refresh functionality implemented)
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('AppModule', () => {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f74fb43 (feat: token refresh functionality implemented)
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'error').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation(jest.fn());
  });
<<<<<<< HEAD
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
=======
>>>>>>> f74fb43 (feat: token refresh functionality implemented)
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have PrismaService as provider', () => {
    const prismaService = module.get(PrismaService);
    expect(prismaService).toBeDefined();
  });
});
