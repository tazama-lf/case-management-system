import { apiClient } from '@/shared';
import type { EntityMetadataResponse } from './types/entityMetadata.interface';

class EntityMetadataService {
  async fetchEntityMetadata(
    alertId: number,
    tenantId: string,
  ): Promise<EntityMetadataResponse> {
    try {
      const response = await apiClient.get<EntityMetadataResponse>(
        `/api/v1/lakehouse/entity-metadata/${alertId}?tenantId=${tenantId}`,
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
}

export default new EntityMetadataService();
