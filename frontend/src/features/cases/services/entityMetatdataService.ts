/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Service handles dynamic API response data */
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */
import { apiClient } from '@/shared';
import type { EntityMetadataResponse } from './types/entityMetadata.interface';

class EntityMetadataService {
  async fetchEntityMetadata(
    alertId: number,
    tenantId: string,
  ): Promise<EntityMetadataResponse> {
    const response = await apiClient.get<EntityMetadataResponse>(
      `/api/v1/lakehouse/entity-metadata/${alertId}?tenantId=${tenantId}`,
    );
    return response;
  }
}

export default new EntityMetadataService();
/* eslint-enable @typescript-eslint/class-methods-use-this */
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
