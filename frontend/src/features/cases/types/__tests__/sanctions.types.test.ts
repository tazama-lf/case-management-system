import { describe, it, expect } from 'vitest';
import {
  SANCTIONS_TOOLS,
  DISPOSITION_OPTIONS,
  type SanctionsScreening,
  type SanctionsDisposition,
  type SanctionsMetadata,
  type MatchedEntity,
  type CreateSanctionsScreeningDto,
  type UpdateSanctionsScreeningDto,
  type SanctionsScreeningResponse,
  type SanctionsScreeningListResponse,
  type DeleteSanctionsScreeningResponse,
  type SanctionsScreeningFilters,
  type SanctionsScreeningAuditLog,
  type SanctionsScreeningStatistics,
  type SanctionsScreeningFormData,
} from '../sanctions.types';

describe('sanctions.types', () => {
  describe('SANCTIONS_TOOLS', () => {
    it('contains expected tools', () => {
      expect(SANCTIONS_TOOLS).toContain('WorldCheck');
      expect(SANCTIONS_TOOLS).toContain('Dow Jones Risk & Compliance');
      expect(SANCTIONS_TOOLS).toContain('ComplyAdvantage');
      expect(SANCTIONS_TOOLS).toContain('LexisNexis Bridger');
      expect(SANCTIONS_TOOLS).toContain('Refinitiv World-Check');
      expect(SANCTIONS_TOOLS).toContain('ACAMS');
      expect(SANCTIONS_TOOLS).toContain('SAS Anti-Money Laundering');
      expect(SANCTIONS_TOOLS).toContain('Other');
    });

    it('has exactly 8 tools', () => {
      expect(SANCTIONS_TOOLS).toHaveLength(8);
    });
  });

  describe('DISPOSITION_OPTIONS', () => {
    it('contains all disposition values', () => {
      const values = DISPOSITION_OPTIONS.map((o) => o.value);
      expect(values).toContain('CLEARED');
      expect(values).toContain('POSITIVE_MATCH');
      expect(values).toContain('FALSE_POSITIVE');
      expect(values).toContain('ESCALATED');
      expect(values).toContain('PENDING_REVIEW');
      expect(values).toContain('REQUIRES_INVESTIGATION');
    });

    it('has exactly 6 options', () => {
      expect(DISPOSITION_OPTIONS).toHaveLength(6);
    });

    it('each option has value, label, color, and icon', () => {
      for (const option of DISPOSITION_OPTIONS) {
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
        expect(option.color).toBeDefined();
        expect(option.icon).toBeDefined();
      }
    });
  });

  describe('Type interfaces', () => {
    it('SanctionsScreening can be typed', () => {
      const screening: SanctionsScreening = {
        screening_id: 'scr-1',
        case_id: 'case-1',
        task_id: 'task-1',
        evidence_id: 'ev-1',
        screening_date: '2024-01-01',
        tool_source: 'WorldCheck',
        reference_id: 'ref-1',
        disposition: 'CLEARED',
        match_count: 0,
        summary: 'No matches found',
        investigator_id: 'inv-1',
        investigator_name: 'John',
        uploaded_at: '2024-01-01T00:00:00Z',
        file_name: 'report.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        metadata: {
          entities_screened: 5,
          watchlists_checked: ['OFAC', 'EU'],
          confidence_score: 0.95,
          risk_level: 'LOW',
        },
        last_updated_at: '2024-01-01T00:00:00Z',
        last_updated_by: 'user-1',
      };
      expect(screening.screening_id).toBe('scr-1');
      expect(screening.disposition).toBe('CLEARED');
    });

    it('MatchedEntity can be typed', () => {
      const entity: MatchedEntity = {
        entity_name: 'John Doe',
        entity_type: 'INDIVIDUAL',
        match_score: 0.85,
        watchlist: 'OFAC',
        category: 'SDN',
        details: 'Partial name match',
      };
      expect(entity.entity_type).toBe('INDIVIDUAL');
      expect(entity.match_score).toBe(0.85);
    });

    it('SanctionsMetadata with matched entities', () => {
      const metadata: SanctionsMetadata = {
        entities_screened: 3,
        watchlists_checked: ['OFAC', 'EU', 'UN'],
        confidence_score: 0.7,
        matched_names: ['John Doe'],
        matched_entities: [
          {
            entity_name: 'John Doe',
            entity_type: 'INDIVIDUAL',
            match_score: 0.85,
            watchlist: 'OFAC',
            category: 'SDN',
          },
        ],
        risk_level: 'HIGH',
        screening_duration_ms: 150,
        api_version: 'v2',
      };
      expect(metadata.matched_entities).toHaveLength(1);
      expect(metadata.risk_level).toBe('HIGH');
    });

    it('CreateSanctionsScreeningDto can be typed', () => {
      const dto: CreateSanctionsScreeningDto = {
        case_id: 'case-1',
        task_id: 'task-1',
        screening_date: '2024-01-01',
        tool_source: 'WorldCheck',
        disposition: 'PENDING_REVIEW',
        summary: 'Pending review',
        reference_id: 'ref-1',
        match_count: 2,
      };
      expect(dto.case_id).toBe('case-1');
      expect(dto.disposition).toBe('PENDING_REVIEW');
    });

    it('UpdateSanctionsScreeningDto can be typed', () => {
      const dto: UpdateSanctionsScreeningDto = {
        screening_id: 'scr-1',
        disposition: 'FALSE_POSITIVE',
        summary: 'Updated summary',
      };
      expect(dto.screening_id).toBe('scr-1');
    });

    it('SanctionsScreeningResponse can be typed', () => {
      const response: SanctionsScreeningResponse = {
        screening: {
          screening_id: 'scr-1',
          case_id: 'case-1',
          screening_date: '2024-01-01',
          tool_source: 'WorldCheck',
          disposition: 'CLEARED',
          match_count: 0,
          summary: 'Clear',
          investigator_id: 'inv-1',
          uploaded_at: '2024-01-01T00:00:00Z',
        },
        message: 'Success',
        success: true,
      };
      expect(response.success).toBe(true);
    });

    it('SanctionsScreeningListResponse can be typed', () => {
      const response: SanctionsScreeningListResponse = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      expect(response.screenings).toHaveLength(0);
      expect(response.pagination.total).toBe(0);
    });

    it('DeleteSanctionsScreeningResponse can be typed', () => {
      const response: DeleteSanctionsScreeningResponse = {
        success: true,
        message: 'Deleted',
        screening_id: 'scr-1',
      };
      expect(response.success).toBe(true);
    });

    it('SanctionsScreeningFilters can be typed', () => {
      const filters: SanctionsScreeningFilters = {
        case_id: 'case-1',
        disposition: 'CLEARED',
        tool_source: 'WorldCheck',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        investigator_id: 'inv-1',
        search: 'test',
      };
      expect(filters.case_id).toBe('case-1');
    });

    it('SanctionsScreeningAuditLog can be typed', () => {
      const log: SanctionsScreeningAuditLog = {
        log_id: 'log-1',
        screening_id: 'scr-1',
        action: 'CREATE',
        user_id: 'user-1',
        user_name: 'Admin',
        timestamp: '2024-01-01T00:00:00Z',
        details: 'Created screening',
        changes: { disposition: { old: 'PENDING_REVIEW', new: 'CLEARED' } },
        ip_address: '127.0.0.1',
      };
      expect(log.action).toBe('CREATE');
    });

    it('SanctionsScreeningStatistics can be typed', () => {
      const stats: SanctionsScreeningStatistics = {
        total_screenings: 50,
        by_disposition: {
          CLEARED: 30,
          POSITIVE_MATCH: 5,
          FALSE_POSITIVE: 10,
          ESCALATED: 2,
          PENDING_REVIEW: 2,
          REQUIRES_INVESTIGATION: 1,
        },
        by_tool_source: { WorldCheck: 25, ComplyAdvantage: 25 },
        recent_screenings: 10,
        high_risk_count: 3,
        pending_review_count: 2,
      };
      expect(stats.total_screenings).toBe(50);
    });

    it('SanctionsScreeningFormData can be typed', () => {
      const form: SanctionsScreeningFormData = {
        screening_date: '2024-01-01',
        tool_source: 'WorldCheck',
        reference_id: 'ref-1',
        disposition: 'CLEARED',
        match_count: 0,
        summary: 'No matches',
        entities_screened: 5,
        watchlists_checked: 'OFAC, EU',
        confidence_score: 0.95,
        risk_level: 'LOW',
      };
      expect(form.tool_source).toBe('WorldCheck');
    });

    it('SanctionsDisposition type accepts valid values', () => {
      const dispositions: SanctionsDisposition[] = [
        'CLEARED',
        'POSITIVE_MATCH',
        'FALSE_POSITIVE',
        'ESCALATED',
        'PENDING_REVIEW',
        'REQUIRES_INVESTIGATION',
      ];
      expect(dispositions).toHaveLength(6);
    });

    it('MatchedEntity supports all entity types', () => {
      const types: MatchedEntity['entity_type'][] = [
        'INDIVIDUAL',
        'ORGANIZATION',
        'VESSEL',
        'OTHER',
      ];
      expect(types).toHaveLength(4);
    });
  });
});
