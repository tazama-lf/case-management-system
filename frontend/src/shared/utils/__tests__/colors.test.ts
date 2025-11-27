import { describe, it, expect } from 'vitest';
import {
  CaseType,
  TaskStatus,
  getCaseTypeColor,
  getTaskStatusColor,
  getCaseTypeColorClass,
  getTaskStatusColorClass,
} from '../colors';

describe('colors', () => {
  describe('CaseType constants', () => {
    it('defines CaseType constants', () => {
      expect(CaseType.FRAUD).toBe('FRAUD');
      expect(CaseType.AML).toBe('AML');
      expect(CaseType.FRAUD_AND_AML).toBe('FRAUD_AND_AML');
      expect(CaseType.NONE).toBe('NONE');
    });
  });

  describe('TaskStatus constants', () => {
    it('defines TaskStatus constants', () => {
      expect(TaskStatus.STATUS_30_COMPLETED).toBe('STATUS_30_COMPLETED');
      expect(TaskStatus.STATUS_20_IN_PROGRESS).toBe('STATUS_20_IN_PROGRESS');
      expect(TaskStatus.STATUS_01_UNASSIGNED).toBe('STATUS_01_UNASSIGNED');
      expect(TaskStatus.STATUS_21_BLOCKED).toBe('STATUS_21_BLOCKED');
      expect(TaskStatus.STATUS_10_ASSIGNED).toBe('STATUS_10_ASSIGNED');
    });
  });

  describe('getCaseTypeColor', () => {
    it('returns correct color for FRAUD', () => {
      expect(getCaseTypeColor(CaseType.FRAUD)).toBe('#ef4444');
      expect(getCaseTypeColor('FRAUD')).toBe('#ef4444');
    });

    it('returns correct color for AML', () => {
      expect(getCaseTypeColor(CaseType.AML)).toBe('#8b5cf6');
      expect(getCaseTypeColor('AML')).toBe('#8b5cf6');
    });

    it('returns correct color for FRAUD_AND_AML', () => {
      expect(getCaseTypeColor(CaseType.FRAUD_AND_AML)).toBe('#f59e0b');
      expect(getCaseTypeColor('FRAUD_AND_AML')).toBe('#f59e0b');
    });

    it('returns default color for NONE or null', () => {
      expect(getCaseTypeColor(CaseType.NONE)).toBe('#3b82f6');
      expect(getCaseTypeColor(null)).toBe('#3b82f6');
      expect(getCaseTypeColor('UNKNOWN')).toBe('#3b82f6');
    });
  });

  describe('getTaskStatusColor', () => {
    it('returns correct color for STATUS_30_COMPLETED', () => {
      expect(getTaskStatusColor(TaskStatus.STATUS_30_COMPLETED)).toBe('#10b981');
      expect(getTaskStatusColor('STATUS_30_COMPLETED')).toBe('#10b981');
    });

    it('returns correct color for STATUS_20_IN_PROGRESS', () => {
      expect(getTaskStatusColor(TaskStatus.STATUS_20_IN_PROGRESS)).toBe('#3b82f6');
      expect(getTaskStatusColor('STATUS_20_IN_PROGRESS')).toBe('#3b82f6');
    });

    it('returns correct color for STATUS_01_UNASSIGNED', () => {
      expect(getTaskStatusColor(TaskStatus.STATUS_01_UNASSIGNED)).toBe('#6b7280');
      expect(getTaskStatusColor('STATUS_01_UNASSIGNED')).toBe('#6b7280');
    });

    it('returns correct color for STATUS_21_BLOCKED', () => {
      expect(getTaskStatusColor(TaskStatus.STATUS_21_BLOCKED)).toBe('#f59e0b');
      expect(getTaskStatusColor('STATUS_21_BLOCKED')).toBe('#f59e0b');
    });

    it('returns correct color for STATUS_10_ASSIGNED', () => {
      expect(getTaskStatusColor(TaskStatus.STATUS_10_ASSIGNED)).toBe('#8b5cf6');
      expect(getTaskStatusColor('STATUS_10_ASSIGNED')).toBe('#8b5cf6');
    });

    it('returns default color for unknown status', () => {
      expect(getTaskStatusColor('UNKNOWN')).toBe('#6b7280');
    });
  });

  describe('getCaseTypeColorClass', () => {
    it('returns correct class for FRAUD', () => {
      expect(getCaseTypeColorClass(CaseType.FRAUD)).toBe(
        'text-red-500 bg-red-50 border-red-200',
      );
      expect(getCaseTypeColorClass('FRAUD')).toBe('text-red-500 bg-red-50 border-red-200');
    });

    it('returns correct class for AML', () => {
      expect(getCaseTypeColorClass(CaseType.AML)).toBe(
        'text-purple-500 bg-purple-50 border-purple-200',
      );
      expect(getCaseTypeColorClass('AML')).toBe('text-purple-500 bg-purple-50 border-purple-200');
    });

    it('returns correct class for FRAUD_AND_AML', () => {
      expect(getCaseTypeColorClass(CaseType.FRAUD_AND_AML)).toBe(
        'text-orange-500 bg-orange-50 border-orange-200',
      );
      expect(getCaseTypeColorClass('FRAUD_AND_AML')).toBe(
        'text-orange-500 bg-orange-50 border-orange-200',
      );
    });

    it('returns default class for NONE or null', () => {
      expect(getCaseTypeColorClass(CaseType.NONE)).toBe(
        'text-blue-500 bg-blue-50 border-blue-200',
      );
      expect(getCaseTypeColorClass(null)).toBe('text-blue-500 bg-blue-50 border-blue-200');
      expect(getCaseTypeColorClass('UNKNOWN')).toBe('text-blue-500 bg-blue-50 border-blue-200');
    });
  });

  describe('getTaskStatusColorClass', () => {
    it('returns correct class for STATUS_30_COMPLETED', () => {
      expect(getTaskStatusColorClass(TaskStatus.STATUS_30_COMPLETED)).toBe(
        'text-green-500 bg-green-50 border-green-200',
      );
      expect(getTaskStatusColorClass('STATUS_30_COMPLETED')).toBe(
        'text-green-500 bg-green-50 border-green-200',
      );
    });

    it('returns correct class for STATUS_20_IN_PROGRESS', () => {
      expect(getTaskStatusColorClass(TaskStatus.STATUS_20_IN_PROGRESS)).toBe(
        'text-blue-500 bg-blue-50 border-blue-200',
      );
      expect(getTaskStatusColorClass('STATUS_20_IN_PROGRESS')).toBe(
        'text-blue-500 bg-blue-50 border-blue-200',
      );
    });

    it('returns correct class for STATUS_01_UNASSIGNED', () => {
      expect(getTaskStatusColorClass(TaskStatus.STATUS_01_UNASSIGNED)).toBe(
        'text-gray-500 bg-gray-50 border-gray-200',
      );
      expect(getTaskStatusColorClass('STATUS_01_UNASSIGNED')).toBe(
        'text-gray-500 bg-gray-50 border-gray-200',
      );
    });

    it('returns correct class for STATUS_21_BLOCKED', () => {
      expect(getTaskStatusColorClass(TaskStatus.STATUS_21_BLOCKED)).toBe(
        'text-orange-500 bg-orange-50 border-orange-200',
      );
      expect(getTaskStatusColorClass('STATUS_21_BLOCKED')).toBe(
        'text-orange-500 bg-orange-50 border-orange-200',
      );
    });

    it('returns correct class for STATUS_10_ASSIGNED', () => {
      expect(getTaskStatusColorClass(TaskStatus.STATUS_10_ASSIGNED)).toBe(
        'text-purple-500 bg-purple-50 border-purple-200',
      );
      expect(getTaskStatusColorClass('STATUS_10_ASSIGNED')).toBe(
        'text-purple-500 bg-purple-50 border-purple-200',
      );
    });

    it('returns default class for unknown status', () => {
      expect(getTaskStatusColorClass('UNKNOWN')).toBe('text-gray-500 bg-gray-50 border-gray-200');
    });
  });
});

