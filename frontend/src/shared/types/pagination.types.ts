export interface TablePaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export interface TablePaginationProps {
  pagination: TablePaginationInfo;
  itemLabel?: string; // e.g., "results", "tasks", "cases"
  className?: string;
}