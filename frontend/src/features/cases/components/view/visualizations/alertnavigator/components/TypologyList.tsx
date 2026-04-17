import React from 'react';

interface TypologyListProps {
  typologies: Array<{
    name: string;
    score: number;
    expanded?: boolean;
  }>;
  expandedIndex: number | null;
  onToggle: (index: number) => void;
}

export const TypologyList: React.FC<TypologyListProps> = ({
  typologies,
  expandedIndex,
  onToggle,
}) => {
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getScoreTextColor = (score: number): string => {
    if (score >= 80) return 'text-red-700';
    if (score >= 60) return 'text-orange-700';
    return 'text-yellow-700';
  };

  return (
    <div className="space-y-2">
      {typologies.map((typology, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
          onClick={() => onToggle(index)}
        >
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${typology.score >= 80
                  ? 'bg-red-500'
                  : typology.score >= 60
                    ? 'bg-orange-500'
                    : 'bg-yellow-500'
                }`}
            />
            <span className="text-sm font-medium text-gray-900">{typology.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${getScoreTextColor(typology.score)}`}>
              {typology.score}
            </span>
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreColor(typology.score)}`}
                style={{ width: `${typology.score}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
