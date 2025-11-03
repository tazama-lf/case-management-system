import React, { useState } from 'react';
import { FunnelIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import FiltersPanel from './FiltersPanel';

interface ReportFiltersProps {
  reportType: 'CASE_STATUS' | 'TASK_COMPLETION' | 'AUDIT_LOGS' | 'CASE_AGEING' | 'INVESTIGATOR_WORKLOAD';
  dateRange: 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastYear';
  onChangeReportType: (type: ReportFiltersProps['reportType']) => void;
  onChangeDateRange: (range: ReportFiltersProps['dateRange']) => void;
  onApplyFilters: (filters: { caseType: string; priority: string; investigator: string }) => void;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({
  reportType,
  dateRange,
  onChangeReportType,
  onChangeDateRange,
  onApplyFilters
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ caseType: '', priority: '', investigator: '' });
  const [openMenu, setOpenMenu] = useState<null | 'report' | 'date'>(null);

  const reportTypeLabels: Record<ReportFiltersProps['reportType'], string> = {
    CASE_STATUS: 'Case Status Report',
    TASK_COMPLETION: 'Task Completion Report', 
    AUDIT_LOGS: 'Audit Logs Report',
    CASE_AGEING: 'Case Ageing Report',
    INVESTIGATOR_WORKLOAD: 'Investigator Workload Report',
  };

  const dateRangeLabels: Record<ReportFiltersProps['dateRange'], string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 Days',
    last30: 'Last 30 Days',
    last90: 'Last 90 Days',
    thisMonth: 'This Month',
    lastYear: 'Last Year',
  };

  const handleToggleReportMenu = () => {
    setOpenMenu(openMenu === 'report' ? null : 'report');
  };

  const handleToggleDateMenu = () => {
    setOpenMenu(openMenu === 'date' ? null : 'date');
  };

  const handleSelectReportType = (type: ReportFiltersProps['reportType']) => {
    onChangeReportType(type);
    setOpenMenu(null);
  };

  const handleSelectDateRange = (range: ReportFiltersProps['dateRange']) => {
    onChangeDateRange(range);
    setOpenMenu(null);
  };

  const handleToggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  const handleChange = (key: 'caseType' | 'priority' | 'investigator', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    setShowFilters(false);
  };

  const handleReset = () => {
    setFilters({ caseType: '', priority: '', investigator: '' });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={handleToggleReportMenu}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <span>{reportTypeLabels[reportType]}</span>
              <FunnelIcon className="h-4 w-4 text-gray-500" />
            </button>
            {openMenu === 'report' && (
              <div className="absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <ul className="py-1 text-sm text-gray-700">
                  {Object.entries(reportTypeLabels).map(([type, label]) => (
                    <li key={type}>
                      <button
                        onClick={() => handleSelectReportType(type as ReportFiltersProps['reportType'])}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={handleToggleDateMenu}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <span>{dateRangeLabels[dateRange]}</span>
              <CalendarDaysIcon className="h-4 w-4 text-gray-500" />
            </button>
            {openMenu === 'date' && (
              <div className="absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <ul className="py-1 text-sm text-gray-700">
                  {Object.entries(dateRangeLabels).map(([range, label]) => (
                    <li key={range}>
                      <button 
                        onClick={() => handleSelectDateRange(range as ReportFiltersProps['dateRange'])} 
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={handleToggleFilters}
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <FunnelIcon className="h-4 w-4 text-gray-500" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <FiltersPanel
          caseType={filters.caseType}
          priority={filters.priority}
          investigator={filters.investigator}
          onChange={handleChange}
          onApply={handleApply}
          onReset={handleReset}
        />
      )}
    </div>
  );
};

export default ReportFilters;
