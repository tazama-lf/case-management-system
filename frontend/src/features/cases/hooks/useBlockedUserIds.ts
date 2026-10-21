import { useEffect, useState } from 'react';
import { investigatorService } from '../services/investigatorService';

/**
 * The ids of the people blocked on a case, fetched when `enabled` turns true. Used by the assign and
 * reassign modals to stop offering them. Starts empty and stays empty if the fetch fails - the backend
 * still refuses to assign a blocked user, this only keeps them out of the dropdown.
 */
export const useBlockedUserIds = (
  caseId: number | undefined,
  enabled: boolean,
): Set<string> => {
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !caseId) {
      setBlocked(new Set());
      return undefined;
    }

    let cancelled = false;
    void investigatorService.getBlockedUserIds(caseId).then((ids) => {
      if (!cancelled) {
        setBlocked(new Set(ids));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [caseId, enabled]);

  return blocked;
};

export default useBlockedUserIds;
