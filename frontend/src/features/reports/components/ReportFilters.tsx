import React from 'react';
import { FunnelIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

interface ReportFiltersProps {
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({ 
  onExportExcel, 
  onExportCSV, 
  onExportPDF 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>
          
          <select className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">Last 30 Days</option>
            <option value="7">Last 7 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>
          
          <select className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="">All Case Types</option>
            <option value="fraud">Fraud</option>
            <option value="aml">AML</option>
            <option value="kyc">Fraud and AML</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Export Options:</span>
          
          <button
            onClick={onExportExcel}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            Export as Excel
          </button>
          
          <button
            onClick={onExportCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            Export as CSV
          </button>
          
          <button
            onClick={onExportPDF}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            Export as PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;
