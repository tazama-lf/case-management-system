import React from 'react';

interface BlockAllowListStatusProps {
  status: string;
}

const BlockAllowListStatus: React.FC<BlockAllowListStatusProps> = ({
  status,
}) => {
  const statusOptions = [
    'Not Listed',
    'Blocked',
    'Allowed',
    'Under Review',
    'Pending Investigation',
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Block/Allow List Status
      </h3>
      <select
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        defaultValue={status}
      >
        {statusOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BlockAllowListStatus;
