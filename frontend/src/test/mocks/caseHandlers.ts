import { http, HttpResponse } from 'msw';

// Define Case type inline for testing
interface Case {
  case_id: string;
  tenant_id: string;
  owner_id: string;
  case_status: string;
  priority: string;
  case_type: string;
  description?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export const mockCases: Case[] = [
  {
    case_id: 'CASE-001',
    tenant_id: 'tenant-1',
    owner_id: 'user-1',
    case_status: 'STATUS_20_IN_PROGRESS',
    priority: 'HIGH',
    case_type: 'FRAUD',
    description: 'Investigation into suspicious transactions',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  },
  {
    case_id: 'CASE-002',
    tenant_id: 'tenant-1',
    owner_id: 'user-2',
    case_status: 'STATUS_00_DRAFT',
    priority: 'MEDIUM',
    case_type: 'AML',
    description: 'AML screening investigation',
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T10:00:00Z',
  } as Case,
  {
    case_id: 'CASE-003',
    tenant_id: 'tenant-1',
    owner_id: 'user-1',
    case_status: 'STATUS_82_CLOSED_CONFIRMED',
    priority: 'CRITICAL',
    case_type: 'FRAUD',
    description: 'Confirmed fraud case',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-12T16:00:00Z',
  } as Case,
];

export const caseHandlers = [
  // Get all cases
  http.get('/api/cases', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let filteredCases = [...mockCases];

    if (search) {
      filteredCases = filteredCases.filter(
        (c) =>
          c.case_id.toLowerCase().includes(search.toLowerCase()) ||
          c.description?.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (status) {
      filteredCases = filteredCases.filter((c) => c.case_status === status);
    }

    if (priority) {
      filteredCases = filteredCases.filter((c) => c.priority === priority);
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedCases = filteredCases.slice(start, end);

    return HttpResponse.json({
      data: paginatedCases,
      page,
      limit,
      total: filteredCases.length,
      totalPages: Math.ceil(filteredCases.length / limit),
    });
  }),

  // Get single case
  http.get('/api/cases/:caseId', ({ params }) => {
    const { caseId } = params;
    const caseData = mockCases.find((c) => c.case_id === caseId);

    if (!caseData) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return HttpResponse.json(caseData);
  }),

  // Create case
  http.post('/api/cases', async ({ request }) => {
    const body = (await request.json()) as Partial<Case>;

    const newCase: Case = {
      case_id: `CASE-${Date.now()}`,
      tenant_id: 'tenant-1',
      owner_id: 'user-1',
      case_status: 'STATUS_00_DRAFT',
      priority: body.priority || 'MEDIUM',
      case_type: body.case_type || 'FRAUD',
      description: body.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    } as Case;

    mockCases.push(newCase);

    return HttpResponse.json(newCase, { status: 201 });
  }),

  // Update case
  http.patch('/api/cases/:caseId', async ({ params, request }) => {
    const { caseId } = params;
    const updates = (await request.json()) as Partial<Case>;

    const caseIndex = mockCases.findIndex((c) => c.case_id === caseId);
    if (caseIndex === -1) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    mockCases[caseIndex] = {
      ...mockCases[caseIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(mockCases[caseIndex]);
  }),

  // Close case
  http.post('/api/cases/:caseId/close', async ({ params, request }) => {
    const { caseId } = params;
    const body = (await request.json()) as any;

    const caseIndex = mockCases.findIndex((c) => c.case_id === caseId);
    if (caseIndex === -1) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    mockCases[caseIndex] = {
      ...mockCases[caseIndex],
      case_status: body.status || 'STATUS_82_CLOSED_CONFIRMED',
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(mockCases[caseIndex]);
  }),

  // Delete case
  http.delete('/api/cases/:caseId', ({ params }) => {
    const { caseId } = params;
    const caseIndex = mockCases.findIndex((c) => c.case_id === caseId);

    if (caseIndex === -1) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    mockCases.splice(caseIndex, 1);

    return HttpResponse.json({ success: true }, { status: 204 });
  }),
];
