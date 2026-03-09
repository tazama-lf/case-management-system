import { Injectable } from '@nestjs/common';
import { AdminRepository } from '../repository/admin.repository';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  async registerReferenceId(idData: Prisma.ReferenceIdCreateInput): Promise<{
    txTp: string;
    referenceIdName: string;
    createdAt: Date;
    id: number;
  }> {
    return await this.adminRepository.registerReferenceId(idData);
  }

  async getReferenceIds(): Promise<
    Array<{
      id: number;
      txTp: string;
      referenceIdName: string;
      createdAt: Date;
    }>
  > {
    const referenceIds = await this.adminRepository.getReferenceId();
    return referenceIds;
  }
}
