import { useQuery } from '@tanstack/react-query';
import type { EntityMetadataResponse } from '../services/types/entityMetadata.interface';
import entityMetatdataService from '../services/entityMetatdataService';

const entityMetadataQueryKeys = {
  all: ['entityMetadata'] as const,
};
export const useEntityMetadata = (
  alertId: number,
  tenantId: string,
): {
  entityMetadata: EntityMetadataResponse | undefined;
  error: unknown;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
} => {
  const {
    data: entityMetadata,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...entityMetadataQueryKeys.all, alertId, tenantId],
    queryFn: async () => {
      const response = await entityMetatdataService.fetchEntityMetadata(
        alertId,
        tenantId,
      );
      return response;
    },
    enabled: !!alertId && !!tenantId,
  });

  return { entityMetadata, error, isLoading, refetch };
};
