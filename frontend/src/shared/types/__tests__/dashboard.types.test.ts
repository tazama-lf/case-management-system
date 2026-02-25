import React from 'react';
import { describe, it, expect } from 'vitest';
import {
  type DashboardStats,
  type Alert,
  type Case,
  type Priority,
  type AlertStatus,
  type CaseStatus,
  type AlertType,
  type CaseType,
} from '../dashboard.types';

// Import the actual module to ensure it's loaded
import * as DashboardTypes from '../dashboard.types';

describe('dashboard.types', () => {
  it('exports the module', () => {
    // TypeScript types don't exist at runtime, so we just verify the module is importable
    expect(DashboardTypes).toBeDefined();
    expect(typeof DashboardTypes).toBe('object');
  });

  describe('DashboardStats', () => {
    it('defines DashboardStats interface with all properties', () => {
      const MockIcon: React.ComponentType<React.SVGProps<SVGSVGElement>> = () =>
        null;
      const stats: DashboardStats = {
        label: 'Total Cases',
        value: '100',
        change: '+10%',
        changeType: 'increase',
        icon: MockIcon,
        color: 'blue',
      };

      expect(stats.label).toBe('Total Cases');
      expect(stats.value).toBe('100');
      expect(stats.change).toBe('+10%');
      expect(stats.changeType).toBe('increase');
      expect(stats.icon).toBe(MockIcon);
      expect(stats.color).toBe('blue');
    });

    it('supports decrease changeType', () => {
      const stats: DashboardStats = {
        label: 'Total Cases',
        value: '100',
        change: '-5%',
        changeType: 'decrease',
        icon: () => null,
        color: 'red',
      };

      expect(stats.changeType).toBe('decrease');
    });
  });

  describe('Alert', () => {
    it('defines Alert interface with all properties', () => {
      const alert: Alert = {
        id: 'ALERT-1',
        type: 'FRAUD',
        priority: 'HIGH',
        message: 'Suspicious transaction',
        status: 'NEW',
        createdAt: '2024-01-01T00:00:00Z',
        confidence: 95,
      };

      expect(alert.id).toBe('ALERT-1');
      expect(alert.type).toBe('FRAUD');
      expect(alert.priority).toBe('HIGH');
      expect(alert.message).toBe('Suspicious transaction');
      expect(alert.status).toBe('NEW');
      expect(alert.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(alert.confidence).toBe(95);
    });

    it('supports all Alert types', () => {
      const fraudAlert: Alert = { ...getBaseAlert(), type: 'FRAUD' };
      const amlAlert: Alert = { ...getBaseAlert(), type: 'AML' };
      const fraudAndAmlAlert: Alert = {
        ...getBaseAlert(),
        type: 'FRAUD_AND_AML',
      };

      expect(fraudAlert.type).toBe('FRAUD');
      expect(amlAlert.type).toBe('AML');
      expect(fraudAndAmlAlert.type).toBe('FRAUD_AND_AML');
    });

    it('supports all Alert statuses', () => {
      const newAlert: Alert = { ...getBaseAlert(), status: 'NEW' };
      const assignedAlert: Alert = { ...getBaseAlert(), status: 'ASSIGNED' };
      const inProgressAlert: Alert = {
        ...getBaseAlert(),
        status: 'IN_PROGRESS',
      };

      expect(newAlert.status).toBe('NEW');
      expect(assignedAlert.status).toBe('ASSIGNED');
      expect(inProgressAlert.status).toBe('IN_PROGRESS');
    });
  });

  describe('Case', () => {
    it('defines Case interface with all properties', () => {
      const caseItem: Case = {
        id: 'CASE-1',
        title: 'Fraud Investigation',
        type: 'FRAUD',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assignee: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        alertsCount: 5,
      };

      expect(caseItem.id).toBe('CASE-1');
      expect(caseItem.title).toBe('Fraud Investigation');
      expect(caseItem.type).toBe('FRAUD');
      expect(caseItem.status).toBe('IN_PROGRESS');
      expect(caseItem.priority).toBe('HIGH');
      expect(caseItem.assignee).toBe('user-1');
      expect(caseItem.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(caseItem.alertsCount).toBe(5);
    });

    it('supports all Case types', () => {
      const fraudCase: Case = { ...getBaseCase(), type: 'FRAUD' };
      const mlCase: Case = { ...getBaseCase(), type: 'MONEY_LAUNDERING' };

      expect(fraudCase.type).toBe('FRAUD');
      expect(mlCase.type).toBe('MONEY_LAUNDERING');
    });

    it('supports all Case statuses', () => {
      const draftCase: Case = { ...getBaseCase(), status: 'DRAFT' };
      const assignedCase: Case = { ...getBaseCase(), status: 'ASSIGNED' };
      const inProgressCase: Case = { ...getBaseCase(), status: 'IN_PROGRESS' };
      const closedCase: Case = { ...getBaseCase(), status: 'CLOSED' };

      expect(draftCase.status).toBe('DRAFT');
      expect(assignedCase.status).toBe('ASSIGNED');
      expect(inProgressCase.status).toBe('IN_PROGRESS');
      expect(closedCase.status).toBe('CLOSED');
    });
  });

  describe('Priority type', () => {
    it('defines all Priority values', () => {
      const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      priorities.forEach((priority) => {
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(priority);
      });
    });

    it('can be used with Alert', () => {
      const lowPriorityAlert: Alert = { ...getBaseAlert(), priority: 'LOW' };
      const mediumPriorityAlert: Alert = {
        ...getBaseAlert(),
        priority: 'MEDIUM',
      };
      const highPriorityAlert: Alert = { ...getBaseAlert(), priority: 'HIGH' };
      const criticalPriorityAlert: Alert = {
        ...getBaseAlert(),
        priority: 'CRITICAL',
      };

      expect(lowPriorityAlert.priority).toBe('LOW');
      expect(mediumPriorityAlert.priority).toBe('MEDIUM');
      expect(highPriorityAlert.priority).toBe('HIGH');
      expect(criticalPriorityAlert.priority).toBe('CRITICAL');
    });

    it('can be used with Case', () => {
      const lowPriorityCase: Case = { ...getBaseCase(), priority: 'LOW' };
      const criticalPriorityCase: Case = {
        ...getBaseCase(),
        priority: 'CRITICAL',
      };

      expect(lowPriorityCase.priority).toBe('LOW');
      expect(criticalPriorityCase.priority).toBe('CRITICAL');
    });
  });

  describe('AlertStatus type', () => {
    it('defines all AlertStatus values', () => {
      const statuses: AlertStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS'];
      statuses.forEach((status) => {
        expect(['NEW', 'ASSIGNED', 'IN_PROGRESS']).toContain(status);
      });
    });
  });

  describe('CaseStatus type', () => {
    it('defines all CaseStatus values', () => {
      const statuses: CaseStatus[] = [
        'DRAFT',
        'ASSIGNED',
        'IN_PROGRESS',
        'CLOSED',
      ];
      statuses.forEach((status) => {
        expect(['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED']).toContain(
          status,
        );
      });
    });
  });

  describe('AlertType type', () => {
    it('defines all AlertType values', () => {
      const types: AlertType[] = ['FRAUD', 'AML', 'FRAUD_AND_AML'];
      types.forEach((type) => {
        expect(['FRAUD', 'AML', 'FRAUD_AND_AML']).toContain(type);
      });
    });
  });

  describe('CaseType type', () => {
    it('defines all CaseType values', () => {
      const types: CaseType[] = ['FRAUD', 'MONEY_LAUNDERING'];
      types.forEach((type) => {
        expect(['FRAUD', 'MONEY_LAUNDERING']).toContain(type);
      });
    });
  });
});

// Helper functions to create base objects
function getBaseAlert(): Omit<Alert, 'type' | 'priority' | 'status'> {
  return {
    id: 'ALERT-1',
    message: 'Test message',
    createdAt: '2024-01-01T00:00:00Z',
    confidence: 95,
  };
}

function getBaseCase(): Omit<Case, 'type' | 'status' | 'priority'> {
  return {
    id: 'CASE-1',
    title: 'Test Case',
    assignee: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    alertsCount: 0,
  };
}
