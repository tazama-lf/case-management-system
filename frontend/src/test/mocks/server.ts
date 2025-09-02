import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { Alert, ActionHistory } from '../../types/triage.types';

// Mock data
const mockAlerts: Alert[] = [
  {
    alert_id: 'ALERT-001',
    tenant_id: 'tenant-1',
    case_id: undefined,
    priority: 'CRITICAL',
    source: 'FRAUD_DETECTION',
    alert_type: 'FRAUD_DETECTION',
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
      edges: [
        { from: 'ACC-001', to: 'ACC-002', weight: 50000 },
      ],
    },
  },
  {
    alert_id: 'ALERT-002',
    tenant_id: 'tenant-1',
    case_id: 'CASE-001',
    priority: 'URGENT',
    source: 'SANCTIONS_SCREENING',
    alert_type: 'SANCTIONS_SCREENING',
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

// API handlers
export const handlers = [
  // Get alerts with filtering and pagination
  http.get('/api/v1/triage/alerts', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const priority = url.searchParams.get('priority');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let filteredAlerts = [...mockAlerts];

    // Apply search filter
    if (search) {
      filteredAlerts = filteredAlerts.filter(
        (alert) =>
          alert.alert_id.toLowerCase().includes(search.toLowerCase()) ||
          alert.message.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply priority filter
    if (priority) {
      filteredAlerts = filteredAlerts.filter((alert) => alert.priority === priority);
    }

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedAlerts = filteredAlerts.slice(start, end);

    // Match backend response format
    const response = {
      data: paginatedAlerts,
      page,
      limit,
      total: filteredAlerts.length,
      totalPages: Math.ceil(filteredAlerts.length / limit),
    };

    return HttpResponse.json(response);
  }),

  // Get single alert
  http.get('/api/v1/triage/alerts/:alertId', ({ params }) => {
    const { alertId } = params;
    const alert = mockAlerts.find((a) => a.alert_id === alertId);

    if (!alert) {
      return HttpResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json(alert);
  }),

  // Get alert action history
  http.get('/api/v1/triage/alerts/:alertId/history', ({ params }) => {
    const { alertId } = params;
    const history = mockActionHistory.filter((h) => h.entity_name === alertId);

    return HttpResponse.json(history);
  }),

  // Update alert
  http.patch('/api/v1/triage/alerts/:alertId', async ({ params, request }) => {
    const { alertId } = params;
    const updates = await request.json() as Partial<Alert>;
    
    const alertIndex = mockAlerts.findIndex((a) => a.alert_id === alertId);
    if (alertIndex === -1) {
      return HttpResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Update the mock alert
    mockAlerts[alertIndex] = {
      ...mockAlerts[alertIndex],
      ...updates,
    };

    return HttpResponse.json(mockAlerts[alertIndex]);
  }),

  // Convert alert to case
  http.post('/api/v1/triage/alerts/:alertId/convert-to-case', async ({ params }) => {
    const { alertId } = params;
    
    const alertIndex = mockAlerts.findIndex((a) => a.alert_id === alertId);
    if (alertIndex === -1) {
      return HttpResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Update alert with case ID
    const caseId = `CASE-${Date.now()}`;
    mockAlerts[alertIndex] = {
      ...mockAlerts[alertIndex],
      case_id: caseId,
    };

    return HttpResponse.json({
      case_id: caseId,
      alert: mockAlerts[alertIndex],
    });
  }),

  // Close alert
  http.patch('/api/v1/triage/alerts/:alertId/close', async ({ params }) => {
    const { alertId } = params;
    
    const alertIndex = mockAlerts.findIndex((a) => a.alert_id === alertId);
    if (alertIndex === -1) {
      return HttpResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Update alert (no status to update since alerts don't have status anymore)
    // mockAlerts[alertIndex] = {
    //   ...mockAlerts[alertIndex],
    // };

    return HttpResponse.json(mockAlerts[alertIndex]);
  }),

  // Error simulation endpoints for testing
  http.get('/api/v1/triage/alerts/error-test', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get('/api/v1/triage/alerts/timeout-test', () => {
    // Simulate network timeout
    return new Promise(() => {
      // Never resolves, simulating timeout
    });
  }),
];

// Create and export the server
export const server = setupServer(...handlers);
