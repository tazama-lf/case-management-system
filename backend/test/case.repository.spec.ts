import { Logger } from '@nestjs/common';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CommentRepository } from '../src/modules/repository/comment.repository';

describe('CaseRepository', () => {
  let repository: CaseRepository;
  let prismaService: { case: { findFirst: jest.Mock } };

  beforeEach(() => {
    prismaService = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    repository = new CaseRepository(
      prismaService as unknown as PrismaService,
      {} as CommentRepository,
      { log: jest.fn() } as unknown as Logger,
    );
  });

  describe('findCaseWithPermissionCheck', () => {
    it('uses standard owner or assigned investigation task checks for every case type', async () => {
      const userId = '11111111-1111-4111-8111-111111111111';

      await repository.findCaseWithPermissionCheck(7, 'tenant-123', userId);

      expect(prismaService.case.findFirst).toHaveBeenCalledWith({
        where: {
          case_id: 7,
          tenant_id: 'tenant-123',
          OR: [
            { case_owner_user_id: userId },
            {
              tasks: {
                some: {
                  assigned_user_id: userId,
                  name: {
                    in: ['Investigate Case', 'Investigate case', 'investigate case'],
                  },
                },
              },
            },
          ],
        },
        include: {
          tasks: true,
          alert: true,
          comments: true,
        },
      });
    });
  });
});
