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
          {}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'report' ? null : 'report')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <span>{
                reportType === 'CASE_STATUS' ? 'Case Status Report' :
                reportType === 'TASK_COMPLETION' ? 'Task Completion Report' :
                reportType === 'AUDIT_LOGS' ? 'Audit Logs' :
                reportType === 'CASE_AGEING' ? 'Case Ageing Report' :
                'Investigator Workload'
              }</span>
              <FunnelIcon className="h-4 w-4 text-gray-500" />
            </button>
            {openMenu === 'report' && (
              <div className="absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <ul className="py-1 text-sm text-gray-700">
                  <li>
                    <button
                      onClick={() => { onChangeReportType('CASE_STATUS'); setOpenMenu(null); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Case Status Report
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { onChangeReportType('TASK_COMPLETION'); setOpenMenu(null); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Task Completion Report
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { onChangeReportType('AUDIT_LOGS'); setOpenMenu(null); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Audit Logs
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { onChangeReportType('CASE_AGEING'); setOpenMenu(null); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Case Ageing Report
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { onChangeReportType('INVESTIGATOR_WORKLOAD'); setOpenMenu(null); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Investigator Workload
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'date' ? null : 'date')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <span>{
                dateRange === 'today' ? 'Today' :
                dateRange === 'yesterday' ? 'Yesterday' :
                dateRange === 'last7' ? 'Last 7 Days' :
                dateRange === 'last30' ? 'Last 30 Days' :
                dateRange === 'last90' ? 'Last 90 Days' :
                dateRange === 'thisMonth' ? 'This Month' : 'Last Year'
              }</span>
              <CalendarDaysIcon className="h-4 w-4 text-gray-500" />
            </button>
            {openMenu === 'date' && (
              <div className="absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <ul className="py-1 text-sm text-gray-700">
                  <li><button onClick={() => { onChangeDateRange('today'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Today</button></li>
                  <li><button onClick={() => { onChangeDateRange('yesterday'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Yesterday</button></li>
                  <li><button onClick={() => { onChangeDateRange('last7'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Last 7 Days</button></li>
                  <li><button onClick={() => { onChangeDateRange('last30'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Last 30 Days</button></li>
                  <li><button onClick={() => { onChangeDateRange('last90'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Last 90 Days</button></li>
                  <li><button onClick={() => { onChangeDateRange('thisMonth'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">This Month</button></li>
                  <li><button onClick={() => { onChangeDateRange('lastYear'); setOpenMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Last Year</button></li>
                </ul>
              </div>
            )}
          </div>

          {}
          <button
            onClick={() => setShowFilters((v) => !v)}
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
