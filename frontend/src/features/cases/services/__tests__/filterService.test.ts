import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterService } from '../filterService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FilterService();
  });

  describe('getFilters', () => {
    it('returns filters for a user and filterType', async () => {
      const filters = [
        {
          filter_Id: 1,
          user_id: 'u1',
          created_at: '2024-01-01',
          user_filters: '{}',
          filter_type: 'ALERT',
          updated_at: '2024-01-02',
          filters: [],
        },
      ];
      mockGet.mockResolvedValueOnce(filters);

      const result = await service.getFilters('u1', 'ALERT');

      expect(mockGet).toHaveBeenCalledWith(
        '/api/v1/filter/user/u1/filterType/ALERT',
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty array when API returns non-array', async () => {
      mockGet.mockResolvedValueOnce(null as any);

      const result = await service.getFilters('u1', 'ALERT');

      expect(result).toEqual([]);
    });

    it('throws on API error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGet.mockRejectedValueOnce(new Error('Server error'));

      await expect(service.getFilters('u1', 'ALERT')).rejects.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('createFilter', () => {
    const dto = { user_id: 'u1', userFilters: '{}', filterType: 'CASE' };

    it('creates a filter and returns it', async () => {
      const created = {
        filter_Id: 1,
        user_id: 'u1',
        created_at: '',
        user_filters: '{}',
        filter_type: 'CASE',
        updated_at: '',
      };
      mockPost.mockResolvedValueOnce(created);

      const result = await service.createFilter(dto);

      expect(mockPost).toHaveBeenCalledWith('/api/v1/filter/create', dto);
      expect(result.filter_Id).toBe(1);
    });

    it('throws FILTER_ALREADY_EXISTS on 409 conflict', async () => {
      mockPost.mockRejectedValueOnce({ response: { status: 409 } });

      await expect(service.createFilter(dto)).rejects.toThrow(
        'FILTER_ALREADY_EXISTS',
      );
    });

    it('throws generic error on other failures', async () => {
      mockPost.mockRejectedValueOnce(new Error('Unexpected'));

      await expect(service.createFilter(dto)).rejects.toThrow('Unexpected');
    });

    it('throws with API response message', async () => {
      mockPost.mockRejectedValueOnce({
        response: { data: { message: 'Validation failed' } },
      });

      await expect(service.createFilter(dto)).rejects.toThrow(
        'Validation failed',
      );
    });
  });
});
