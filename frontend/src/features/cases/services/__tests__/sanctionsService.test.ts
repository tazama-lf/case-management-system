import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sanctionsService from '../sanctionsService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('sanctionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets case sanctions screenings', async () => {
    const mockScreenings = {
      screenings: [
        {
          id: 'SCREENING-1',
          case_id: 'CASE-123',
          status: 'PENDING',
        },
      ],
      total: 1,
    };
    (apiClient.get as vi.Mock).mockResolvedValue(mockScreenings);

    const result = await sanctionsService.getCaseSanctionsScreenings('CASE-123');

    expect(apiClient.get).toHaveBeenCalled();
    expect(result).toEqual(mockScreenings);
  });

  it('gets sanctions screening by ID', async () => {
    const mockScreening = {
      id: 'SCREENING-1',
      case_id: 'CASE-123',
      status: 'PENDING',
    };
    (apiClient.get as vi.Mock).mockResolvedValue(mockScreening);

    const result = await sanctionsService.getSanctionsScreening('SCREENING-1');

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/sanctions-screenings/SCREENING-1');
    expect(result).toEqual(mockScreening);
  });

  it('creates sanctions screening', async () => {
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const mockResponse = {
      screening: {
        id: 'SCREENING-1',
        case_id: 'CASE-123',
      },
    };
    (apiClient.post as vi.Mock).mockResolvedValue(mockResponse);

    const result = await sanctionsService.createSanctionsScreening({
      case_id: 'CASE-123',
      screening_date: '2024-01-01',
      tool_source: 'OFAC',
      disposition: 'CLEAR',
      summary: 'Test screening',
      file: mockFile,
    });

    expect(apiClient.post).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('handles errors when sanctions operation fails', async () => {
    const error = new Error('Failed to get screening');
    (apiClient.get as vi.Mock).mockRejectedValue(error);

    await expect(
      sanctionsService.getSanctionsScreening('SCREENING-1'),
    ).rejects.toThrow();
  });
});

