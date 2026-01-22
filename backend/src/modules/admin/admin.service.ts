import { Injectable } from '@nestjs/common';
import { AdminRepository } from '../repository/admin.repository';
import { Prisma } from '@prisma/client-cms';

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  async registerReferenceId(idData: Prisma.ReferenceIdCreateInput): Promise<Prisma.ReferenceIdCreateInput> {
    try {
      const referenceId = await this.adminRepository.registerReferenceId(idData);

      return { txTp: referenceId.txTp, referenceIdName: referenceId.referenceIdName };
    } catch (error) {
      throw error;
    }
  }

  async getReferenceIds() {
    try {
      const referenceIds = await this.adminRepository.getReferenceId();
      return referenceIds;
    } catch (error) {
      throw error;
    }
  }
}
