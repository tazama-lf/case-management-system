import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CaseType, Priority } from '@prisma/client-cms';
import request from 'supertest';
import { TriageController } from '../src/modules/triage/triage.controller';
import { TriageService } from '../src/modules/triage/triage.service';
import { TazamaAuthGuard } from '../src/guards/tazama-auth.guard';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      tenantName: 'Test Tenant',
      token: {
        claims: ['CMS_INVESTIGATOR'],
        clientId: 'user-123',
        email: 'investigator@example.test',
        fullName: 'Test Investigator',
        tenantId: 'tenant-123',
      },
    };
    return true;
  }
}

describe('TriageController', () => {
  let app: INestApplication;
  let triageService: jest.Mocked<Pick<TriageService, 'handleManualTriage'>>;
  let auditLogger: { log: jest.Mock };

  beforeEach(async () => {
    triageService = {
      handleManualTriage: jest.fn(),
    };
    auditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TriageController],
      providers: [
        {
          provide: TriageService,
          useValue: triageService,
        },
        {
          provide: 'AUDIT_LOGGER',
          useValue: auditLogger,
        },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: false,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects manual triage when priorityScore is missing', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/triage/alerts/1')
      .set('Authorization', 'Bearer test-token')
      .send({
        priority: Priority.HIGH,
        alertType: CaseType.FRAUD,
        note: 'test note',
      })
      .expect(400);

    expect(triageService.handleManualTriage).not.toHaveBeenCalled();
  });
});
