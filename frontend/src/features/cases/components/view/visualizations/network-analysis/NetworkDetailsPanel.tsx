import React from 'react';

export interface DetailField {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface SummaryField {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface NetworkDetailsPanelProps {
  title: string;
  fields: DetailField[];
  summaryTitle?: string;
  summaryFields?: SummaryField[];
}

const NetworkDetailsPanel: React.FC<NetworkDetailsPanelProps> = ({
  title,
  fields,
  summaryTitle,
  summaryFields,
}) => {
  return (
    <div className="h-full w-72 border-gray-200 bg-white p-4">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>

      <div className="mt-4 space-y-4">
        {fields.map((field, index) => (
          <div key={index}>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {field.label}
            </div>
            <div
              className={`mt-1 text-sm font-medium ${
                field.highlight ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {field.value}
            </div>
          </div>
        ))}
      </div>

      {summaryTitle && summaryFields && (
        <>
          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {summaryTitle}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {summaryFields.map((field, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{field.label}:</span>
                <span
                  className={`text-sm font-semibold ${
                    field.highlight ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default NetworkDetailsPanel;
