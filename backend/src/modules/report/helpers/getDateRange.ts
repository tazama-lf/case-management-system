export default function getDateRange(dateRange?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let endDate = new Date(now);
  let startDate = new Date(now);

  switch (dateRange) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last7':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'last30':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'last90':
      startDate.setDate(now.getDate() - 90);
      break;
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastYear':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return { startDate, endDate };
}
