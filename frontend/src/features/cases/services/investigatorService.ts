// Case-level ACL (allowlist/blocklist) API
//
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances, matching evidenceService.ts's convention */
import apiClient from '../../../shared/services/apiClient';
import type {
  CaseAccessHistory,
  CaseInvestigator,
  CaseInvestigatorBlocklistEntry,
  BlocklistCaseInvestigatorDto,
} from '../types/investigator.types';

export class InvestigatorService {
  private readonly baseUrl = '/api/v1/cases';

  async getCaseInvestigators(caseId: number): Promise<CaseInvestigator[]> {
    try {
      const response = await apiClient.get<CaseInvestigator[]>(
        `${this.baseUrl}/${caseId}/investigators`,
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      throw this.handleError(error, 'get case investigators');
    }
  }

  async getCaseBlocklist(
    caseId: number,
  ): Promise<CaseInvestigatorBlocklistEntry[]> {
    try {
      const response = await apiClient.get<CaseInvestigatorBlocklistEntry[]>(
        `${this.baseUrl}/${caseId}/blocklist`,
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      throw this.handleError(error, 'get case blocklist');
    }
  }

  /**
   * Ids of the people currently blocked on a case, so the assign / reassign dropdowns can leave them out.
   * Open to anyone who may view the case (ids only). Never throws: if it can't be fetched the dropdown
   * simply isn't filtered, and the backend still refuses to assign a blocked user.
   */
  async getBlockedUserIds(caseId: number): Promise<string[]> {
    try {
      const response = await apiClient.get<{ userIds?: string[] } | null>(
        `${this.baseUrl}/${caseId}/blocked-users`,
      );
      return Array.isArray(response?.userIds) ? response.userIds : [];
    } catch (error) {
      console.error('InvestigatorService Error - get blocked users:', error);
      return [];
    }
  }

  async getCaseAccessHistory(caseId: number): Promise<CaseAccessHistory> {
    try {
      const response = await apiClient.get<Partial<CaseAccessHistory> | null>(
        `${this.baseUrl}/${caseId}/investigators/history`,
      );
      return {
        revoked: Array.isArray(response?.revoked) ? response.revoked : [],
        unblocked: Array.isArray(response?.unblocked) ? response.unblocked : [],
      };
    } catch (error) {
      throw this.handleError(error, 'get case access history');
    }
  }

  // No addInvestigator. The allowlist is populated exclusively by task
  // assignment; nobody adds to it by hand, supervisor
  // included.

  async revokeInvestigator(
    caseId: number,
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      await apiClient.delete<undefined>(
        `${this.baseUrl}/${caseId}/investigators/${userId}`,
        { body: JSON.stringify({ reason }) },
      );
    } catch (error) {
      throw this.handleError(error, 'revoke investigator');
    }
  }

  async blocklistInvestigator(
    caseId: number,
    dto: BlocklistCaseInvestigatorDto,
  ): Promise<CaseInvestigatorBlocklistEntry> {
    try {
      return await apiClient.post<CaseInvestigatorBlocklistEntry>(
        `${this.baseUrl}/${caseId}/blocklist`,
        dto,
      );
    } catch (error) {
      throw this.handleError(error, 'blocklist investigator');
    }
  }

  async unblockInvestigator(
    caseId: number,
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      await apiClient.delete<undefined>(
        `${this.baseUrl}/${caseId}/blocklist/${userId}`,
        { body: JSON.stringify({ reason }) },
      );
    } catch (error) {
      throw this.handleError(error, 'unblock investigator');
    }
  }

  private handleError(error: unknown, operation: string): Error {
    console.error(`InvestigatorService Error - ${operation}:`, error);

    if (error instanceof Error) {
      return error;
    }

    return new Error(`Failed to ${operation}`);
  }
}

export const investigatorService = new InvestigatorService();
/* eslint-enable @typescript-eslint/class-methods-use-this */
