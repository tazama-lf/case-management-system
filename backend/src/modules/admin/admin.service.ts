import { Injectable } from '@nestjs/common';
import { AdminRepository } from '../repository/admin.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  async registerReferenceId(idData: Prisma.ReferenceIdCreateInput) {
    try {
      const referenceId = await this.adminRepository.registerReferenceId(idData);

      return referenceId;
    } catch (error) {
      throw error;
    }
  }
}
