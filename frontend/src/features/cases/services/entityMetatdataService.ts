import { apiClient } from '@/shared';
import type { EntityMetadataResponse } from './types/entityMetadata.interface';

const EntityMetadataService = {
  async fetchEntityMetadata(
    alertId: number,
    tenantId: string,
  ): Promise<EntityMetadataResponse> {
    const response = await apiClient.get<EntityMetadataResponse>(
      `/api/v1/lakehouse/entity-metadata/${alertId}?tenantId=${tenantId}`,
    );
    return response;
  },
};

export default EntityMetadataService;
