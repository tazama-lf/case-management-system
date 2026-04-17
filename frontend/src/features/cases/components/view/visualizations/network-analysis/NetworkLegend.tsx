import React from 'react';

export interface LegendItem {
  color: string;
  ringColor?: string;
  label: string;
  type: 'circle' | 'line';
  lineStyle?: 'solid' | 'dashed';
  hasArrow?: boolean;
}

interface NetworkLegendProps {
  items: LegendItem[];
}

const NetworkLegend: React.FC<NetworkLegendProps> = ({ items }) => {
  const renderLegendIcon = (item: LegendItem) => {
    if (item.type === 'line') {
      return (
        <svg width="24" height="16" className="flex-shrink-0">
          <line
            x1="0"
            y1="8"
            x2="20"
            y2="8"
            stroke={item.color}
            strokeWidth={2}
            strokeDasharray={item.lineStyle === 'dashed' ? '4,2' : undefined}
          />
          {item.hasArrow && (
            <polygon
              points="16,4 24,8 16,12"
              fill={item.color}
            />
          )}
        </svg>
      );
    }

    return (
      <svg width="16" height="16" className="flex-shrink-0">
        {item.ringColor && (
          <circle
            cx="8"
            cy="8"
            r="7"
            fill="none"
            stroke={item.ringColor}
            strokeWidth={2}
          />
        )}
        <circle
          cx="8"
          cy="8"
          r={item.ringColor ? 5 : 6}
          fill={item.color}
        />
      </svg>
    );
  };

  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 text-xs font-semibold text-gray-700">Legend</div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {renderLegendIcon(item)}
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkLegend;
