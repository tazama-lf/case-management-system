import { useState, useEffect } from 'react';
import userService from '../services/userService';
import type { UserOption } from '../services/userService';

export const useInvestigatorSupervisorList = (): {
  supervisors: UserOption[];
  investigators: UserOption[];
  complianceOfficers: UserOption[];
  loadingInvestigators: boolean;
  loadingSupervisors: boolean;
  fetchInvestigatorsList: () => Promise<void>;
  fetchSupervisorsList: () => Promise<void>;
  fetchComplianceOfficersList: () => Promise<void>;
  clearCache: () => void;
} => {
  const supervisorsCacheKey = 'supervisors';
  const investigatorsCacheKey = 'investigators';
  const complianceCacheKey = 'compliance';

  const [supervisors, setSupervisors] = useState<UserOption[]>(() => {
    const cached = sessionStorage.getItem(supervisorsCacheKey);
    return cached ? (JSON.parse(cached) as UserOption[]) : [];
  });

  const [investigators, setInvestigators] = useState<UserOption[]>(() => {
    const cached = sessionStorage.getItem(investigatorsCacheKey);
    return cached ? (JSON.parse(cached) as UserOption[]) : [];
  });

  const [complianceOfficers, setComplianceOfficers] = useState<UserOption[]>(
    () => {
      const cached = sessionStorage.getItem(complianceCacheKey);
      return cached ? (JSON.parse(cached) as UserOption[]) : [];
    },
  );

  const [loadingInvestigators, setLoadingInvestigators] = useState(false);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  const fetchInvestigatorsList = async (): Promise<void> => {
    setLoadingInvestigators(true);
    try {
      const cached = sessionStorage.getItem(investigatorsCacheKey);
      if (cached) {
        setInvestigators(JSON.parse(cached) as UserOption[]);
        return;
      }

      const data = await userService.getInvestigators();
      if (data.length > 0) {
        setInvestigators(data);
        sessionStorage.setItem(investigatorsCacheKey, JSON.stringify(data));
      } else {
        console.warn('No investigators returned from service.');
        setInvestigators([]);
      }
    } catch (error) {
      console.error('Failed to fetch investigators:', error);
      setInvestigators([]);
    } finally {
      setLoadingInvestigators(false);
    }
  };

  const fetchComplianceOfficersList = async (): Promise<void> => {
    try {
      const cached = sessionStorage.getItem(complianceCacheKey);
      if (cached) {
        setComplianceOfficers(JSON.parse(cached) as UserOption[]);
        return;
      }

      const data = await userService.getComplianceOfficers();
      if (data.length > 0) {
        setComplianceOfficers(data);
        sessionStorage.setItem(complianceCacheKey, JSON.stringify(data));
      } else {
        console.warn('No investigators returned from service.');
        setComplianceOfficers([]);
      }
    } catch (error) {
      console.error('Failed to fetch investigators:', error);
      setComplianceOfficers([]);
    }
  };

  const fetchSupervisorsList = async (): Promise<void> => {
    setLoadingSupervisors(true);
    try {
      const cached = sessionStorage.getItem(supervisorsCacheKey);
      if (cached) {
        setSupervisors(JSON.parse(cached) as UserOption[]);
        return;
      }

      const data = await userService.getSupervisors();
      if (data.length > 0) {
        setSupervisors(data);
        sessionStorage.setItem(supervisorsCacheKey, JSON.stringify(data));
      } else {
        console.warn('No supervisors returned from service.');
        setSupervisors([]);
      }
    } catch (error) {
      console.error('Failed to fetch supervisors:', error);
      setSupervisors([]);
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const clearCache = (): void => {
    sessionStorage.removeItem(investigatorsCacheKey);
    setInvestigators([]);
    sessionStorage.removeItem(supervisorsCacheKey);
    setSupervisors([]);
  };

  useEffect(() => {
    fetchInvestigatorsList();
    fetchSupervisorsList();
    fetchComplianceOfficersList();
  }, []);

  return {
    investigators,
    supervisors,
    complianceOfficers,
    loadingInvestigators,
    loadingSupervisors,
    fetchInvestigatorsList,
    fetchSupervisorsList,
    fetchComplianceOfficersList,
    clearCache,
  };
};

export default useInvestigatorSupervisorList;
