import React from 'react';

interface ReportSectionHeaderProps {
  title: string;
  badge: string;
  badgeColor: 'green' | 'blue';
  description?: string;
}

const badgeClasses: Record<ReportSectionHeaderProps['badgeColor'], string> = {
  green: 'bg-green-50 text-green-700 border border-green-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
};

/** Marks which of the two lifecycle-scoped datasets a report section reads from. */
const ReportSectionHeader: React.FC<ReportSectionHeaderProps> = ({
  title,
  badge,
  badgeColor,
  description,
}) => (
  <div className="mb-4">
    <div className="flex items-center gap-3 flex-wrap">
      <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
        {title}
      </h2>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClasses[badgeColor]}`}
      >
        {badge}
      </span>
    </div>
    {description && (
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    )}
  </div>
);

export default ReportSectionHeader;
