import {
  getStatusColor,
  getTypeColor,
  getPriorityColor,
  getScoreColor,
  transformBackendCaseToUI,
} from '../casesTable.utils';
import { describe, it, expect } from 'vitest';
import type { CaseWithTasksDto } from '../../services/caseService';

describe('casesTable.utils', () => {
  describe('Color Helpers', () => {
    it('should return correct status color', () => {
      expect(getStatusColor('STATUS_20_IN_PROGRESS')).toContain('bg-yellow-50');
      expect(getStatusColor('UNKNOWN')).toContain('bg-gray-100');
    });

    it('should return correct type color', () => {
      expect(getTypeColor('FRAUD')).toContain('bg-red-50');
      expect(getTypeColor('UNKNOWN')).toContain('bg-gray-50');
    });

    it('should return correct priority color', () => {
      expect(getPriorityColor('URGENT')).toContain('bg-yellow-50');
      expect(getPriorityColor('UNKNOWN')).toContain('bg-gray-50');
    });

    it('should return correct score color', () => {
      expect(getScoreColor(85)).toContain('text-red-600');
      expect(getScoreColor(65)).toContain('text-orange-600');
      expect(getScoreColor(45)).toContain('text-yellow-600');
      expect(getScoreColor(10)).toContain('text-green-600');
      expect(getScoreColor(0)).toContain('text-gray-600');
    });
  });

  describe('transformBackendCaseToUI', () => {
    const mockBackendCase: CaseWithTasksDto = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      total_tasks: 5,
      user_role: 'owner',
      assigned_to: { user_id: 'user-1', username: 'User 1' },
      alert: {
        alert_id: 'ALERT-1',
        confidence_per: 85,
        message: 'Test Alert',
      },
    } as any;

    it('should transform backend case to UI format', () => {
      const result = transformBackendCaseToUI(mockBackendCase);

      expect(result.id).toBe('CASE-123');
      expect(result.type).toBe('FRAUD');
      expect(result.status).toBe('STATUS_20_IN_PROGRESS');
      expect(result.score).toBe(85);
      expect(result.assignee).toBe('Current User');
      expect(result.userRole).toBe('owner');
      expect(result.action).toBe('View');
    });

    it('should handle draft status correctly', () => {
      const draftCase = { ...mockBackendCase, status: 'STATUS_00_DRAFT' };
      const result = transformBackendCaseToUI(draftCase as any);

      expect(result.action).toBe('Complete');
    });

    it('should handle unassigned case', () => {
      const unassignedCase = { ...mockBackendCase, assigned_to: null };
      const result = transformBackendCaseToUI(unassignedCase as any);

      expect(result.assignee).toBe('Current User'); // Fallback logic in utils
    });
  });
});
