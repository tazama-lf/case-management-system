import { useState, useEffect } from 'react';
import userService from '../services/userService';
import type { UserOption } from '../services/userService';

export const useInvestigatorSupervisorList = () => {
  const supervisorsCacheKey = 'supervisors';
  const investigatorsCacheKey = 'investigators';

  const [supervisors, setSupervisors] = useState<UserOption[]>(() => {
    const cached = sessionStorage.getItem(supervisorsCacheKey);
    return cached ? JSON.parse(cached) : [];
  });

  const [investigators, setInvestigators] = useState<UserOption[]>(() => {
    const cached = sessionStorage.getItem(investigatorsCacheKey);
    return cached ? JSON.parse(cached) : [];
  });

  const [loadingInvestigators, setLoadingInvestigators] = useState(false);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  const fetchInvestigatorsList = async () => {
    setLoadingInvestigators(true);
    try {
      const cached = sessionStorage.getItem(investigatorsCacheKey);
      if (cached) {
        setInvestigators(JSON.parse(cached));
        return;
      }

      const data = await userService.getInvestigators();
      if (data?.length > 0) {
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

  const fetchSupervisorsList = async () => {
    setLoadingSupervisors(true);
    try {
      const cached = sessionStorage.getItem(supervisorsCacheKey);
      if (cached) {
        setSupervisors(JSON.parse(cached));
        return;
      }

      const data = await userService.getSupervisors();
      if (data?.length > 0) {
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

  const clearCache = () => {
    sessionStorage.removeItem(investigatorsCacheKey);
    setInvestigators([]);
    sessionStorage.removeItem(supervisorsCacheKey);
    setSupervisors([]);
  };

  useEffect(() => {
    fetchInvestigatorsList();
    fetchSupervisorsList();
  }, []);

  return {
    investigators,
    supervisors,
    loadingInvestigators,
    loadingSupervisors,
    fetchInvestigatorsList,
    fetchSupervisorsList,
    clearCache,
  };
};

export default useInvestigatorSupervisorList;
