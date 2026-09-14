// Case-level ACL (whitelist/blacklist) API
//
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances, matching evidenceService.ts's convention */
import apiClient from '../../../shared/services/apiClient';
import type {
  CaseInvestigator,
  CaseInvestigatorBlacklistEntry,
  BlacklistCaseInvestigatorDto,
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

  async getCaseBlacklist(
    caseId: number,
  ): Promise<CaseInvestigatorBlacklistEntry[]> {
    try {
      const response = await apiClient.get<CaseInvestigatorBlacklistEntry[]>(
        `${this.baseUrl}/${caseId}/blacklist`,
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      throw this.handleError(error, 'get case blacklist');
    }
  }

  // No addInvestigator. The whitelist is populated exclusively by task assignment and
  // case ownership; nobody adds to it by hand, supervisor included.

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

  async blacklistInvestigator(
    caseId: number,
    dto: BlacklistCaseInvestigatorDto,
  ): Promise<CaseInvestigatorBlacklistEntry> {
    try {
      return await apiClient.post<CaseInvestigatorBlacklistEntry>(
        `${this.baseUrl}/${caseId}/blacklist`,
        dto,
      );
    } catch (error) {
      throw this.handleError(error, 'blacklist investigator');
    }
  }

  async unblockInvestigator(
    caseId: number,
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      await apiClient.delete<undefined>(
        `${this.baseUrl}/${caseId}/blacklist/${userId}`,
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
