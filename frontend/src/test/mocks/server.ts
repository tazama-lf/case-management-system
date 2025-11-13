import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type {
  Alert,
  ActionHistory,
} from '../../features/alerts/types/triage.types';

const mockAlerts: Alert[] = [
  {
    alert_id: 'ALERT-001',
    tenant_id: 'tenant-1',
    case_id: undefined,
    priority: 'CRITICAL',
    source: 'FRAUD',
    alert_type: 'FRAUD',
    message: 'Suspicious transaction pattern detected',
    confidence_per: 85,
    created_at: '2024-01-15T10:30:00Z',
    alert_data: {
      transaction_amount: 50000,
      transaction_currency: 'USD',
      transaction_type: 'TRANSFER',
    },
    transaction: {
      transaction_id: 'TXN-001',
      amount: 50000,
      currency: 'USD',
      from_account: 'ACC-001',
      to_account: 'ACC-002',
    },
    network_map: {
      nodes: [
        { id: 'ACC-001', type: 'account' },
        { id: 'ACC-002', type: 'account' },
      ],
      edges: [{ from: 'ACC-001', to: 'ACC-002', weight: 50000 }],
    },
  },
  {
    alert_id: 'ALERT-002',
    tenant_id: 'tenant-1',
    case_id: 'CASE-001',
    priority: 'URGENT',
    source: 'AML',
    alert_type: 'AML',
    message: 'Potential sanctions list match found',
    confidence_per: 75,
    created_at: '2024-01-14T15:45:00Z',
    alert_data: {
      entity_name: 'John Doe',
      match_score: 0.75,
      sanctions_list: 'OFAC',
    },
    transaction: null,
    network_map: null,
  },
];

const mockActionHistory: ActionHistory[] = [
  {
    audit_log_id: 'LOG-001',
    user_id: 'SYSTEM',
    operation: 'CREATE',
    entity_name: 'ALERT-001',
    action_performed: 'Alert created by fraud detection system',
    outcome: 'SUCCESS',
    performed_at: '2024-01-15T10:30:00Z',
  },
  {
    audit_log_id: 'LOG-002',
    user_id: 'analyst@example.com',
    operation: 'UPDATE',
    entity_name: 'ALERT-001',
    action_performed: 'Priority updated to HIGH',
    outcome: 'SUCCESS',
    performed_at: '2024-01-15T11:00:00Z',
  },
];

export const handlers = [
  http.get('/api/v1/triage/alerts', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const priority = url.searchParams.get('priority');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let filteredAlerts = [...mockAlerts];

    if (search) {
      filteredAlerts = filteredAlerts.filter(
        (alert) =>
          alert.alert_id.toLowerCase().includes(search.toLowerCase()) ||
          alert.message.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (priority) {
      filteredAlerts = filteredAlerts.filter(
        (alert) => alert.priority === priority,
      );
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedAlerts = filteredAlerts.slice(start, end);

    const response = {
      data: paginatedAlerts,
      page,
      limit,
      total: filteredAlerts.length,
      totalPages: Math.ceil(filteredAlerts.length / limit),
    };

    return HttpResponse.json(response);
  }),

  http.get('/api/v1/triage/alerts/:alertId', ({ params }) => {
    const { alertId } = params;
    const alert = mockAlerts.find((a) => a.alert_id === alertId);

    if (!alert) {
      return HttpResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return HttpResponse.json(alert);
  }),

  http.get('/api/v1/triage/alerts/:alertId/history', ({ params }) => {
    const { alertId } = params;
    const history = mockActionHistory.filter((h) => h.entity_name === alertId);

    return HttpResponse.json(history);
  }),

  http.patch('/api/v1/triage/alerts/:alertId', async ({ params, request }) => {
    const { alertId } = params;
    const updates = (await request.json()) as any;

    const alertIndex = mockAlerts.findIndex((a) => a.alert_id === alertId);
    if (alertIndex === -1) {
      return HttpResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    if (
      updates.priorityScore !== undefined ||
      updates.predictionOutcome !== undefined
    ) {
      if (
        updates.alertType &&
        !['FRAUD', 'AML', 'FRAUD_AND_AML', 'NONE'].includes(updates.alertType)
      ) {
        return HttpResponse.json(
          {
            message: [
              'alertType must be one of the following values: FRAUD, AML, FRAUD_AND_AML, NONE',
            ],
            error: 'Bad Request',
            statusCode: 400,
          },
          { status: 400 },
        );
      }

      const updatedAlert = {
        ...mockAlerts[alertIndex],
        priority: updates.priority || mockAlerts[alertIndex].priority,
        confidence_per:
          updates.confidence_per || mockAlerts[alertIndex].confidence_per,
        alert_type: updates.alertType || mockAlerts[alertIndex].alert_type,
        prediction_outcome: updates.predictionOutcome,
      };

      mockAlerts[alertIndex] = updatedAlert;

      const newHistoryEntry: ActionHistory = {
        audit_log_id: `LOG-${Date.now()}`,
        user_id: 'test-user@example.com',
        operation: 'MANUAL_TRIAGE',
        entity_name: String(alertId),
        action_performed: `Manual triage completed - ${updates.note || 'No notes provided'}`,
        outcome: 'SUCCESS',
        performed_at: new Date().toISOString(),
      };
      mockActionHistory.push(newHistoryEntry);

      return HttpResponse.json(updatedAlert);
    } else {
      mockAlerts[alertIndex] = {
        ...mockAlerts[alertIndex],
        ...updates,
      };
      return HttpResponse.json(mockAlerts[alertIndex]);
    }
  }),

  http.post(
    '/api/v1/triage/alerts/:alertId/convert-to-case',
    async ({ params }) => {
      const { alertId } = params;

      const alertIndex = mockAlerts.findIndex((a) => a.alert_id === alertId);
      if (alertIndex === -1) {
        return HttpResponse.json({ error: 'Alert not found' }, { status: 404 });
      }

      const caseId = `CASE-${Date.now()}`;
      mockAlerts[alertIndex] = {
        ...mockAlerts[alertIndex],
        case_id: caseId,
      };

      return HttpResponse.json({
        case_id: caseId,
        alert: mockAlerts[alertIndex],
      });
    },
  ),

  http.patch('/api/v1/triage/alerts/:alertId/close', async ({ params }) => {
    const { alertId } = params;

    const alertIndex = mockAlerts.findIndex((a) => a.alert_id === alertId);
    if (alertIndex === -1) {
      return HttpResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return HttpResponse.json(mockAlerts[alertIndex]);
  }),

  http.get('/api/v1/triage/alerts/error-test', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }),

  http.get('/api/v1/triage/alerts/timeout-test', () => {
    return new Promise(() => {});
  }),
];

export const server = setupServer(...handlers);
