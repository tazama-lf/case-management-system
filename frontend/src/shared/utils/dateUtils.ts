export const formatDate = (
  dateString: string | Date | undefined | null,
): string => {
  if (!dateString) {
    return '-';
  }

  const date =
    typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateFull = (
  dateString: string | Date | undefined | null,
): string => {
  if (!dateString) {
    return '-';
  }

  const date =
    typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (
  dateString: string | Date | undefined | null,
): string => {
  if (!dateString) {
    return '-';
  }

  const date =
    typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) {
    return 'Invalid Time';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateOnly = (
  dateString: string | Date | undefined | null,
): string => {
  if (!dateString) {
    return '-';
  }

  const date =
    typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Calculates the time difference between two dates
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object (defaults to now)
 * @returns Human readable time difference (e.g., "2 hours ago", "3 days ago")
 */
export const getTimeAgo = (
  startDate: string | Date | undefined | null,
  endDate: string | Date = new Date(),
): string => {
  if (!startDate) {
    return '-';
  }

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid Date';
  }

  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDateOnly(start);
};
