import React, { useEffect, useState } from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'indigo';
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
}) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const isNumeric = typeof value === 'number';

  // Soft tinted icon badge (bg-50 + text-600) reads as a modern accent chip
  // rather than a heavy solid block, while staying legible on white.
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  const bgColorClasses = {
    blue: 'hover:bg-blue-50',
    red: 'hover:bg-red-50',
    yellow: 'hover:bg-yellow-50',
    green: 'hover:bg-green-50',
    purple: 'hover:bg-purple-50',
    indigo: 'hover:bg-indigo-50',
  };

  const accentBorderClasses = {
    blue: 'border-l-blue-500',
    red: 'border-l-red-500',
    yellow: 'border-l-yellow-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
    indigo: 'border-l-indigo-500',
  };

  useEffect(() => {
    setIsVisible(true);

    if (isNumeric) {
      const duration = 1000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setAnimatedValue(value);
          clearInterval(timer);
        } else {
          setAnimatedValue(Math.floor(current));
        }
      }, duration / steps);

      return () => {
        clearInterval(timer);
      };
    } else {
      setAnimatedValue(0);
    }
  }, [value, isNumeric]);

  const getDisplayValue = () => {
    if (typeof value === 'string') {
      return value;
    }
    if (
      value === null ||
      value === undefined ||
      isNaN(value) ||
      !isFinite(value)
    ) {
      return '0';
    }
    return animatedValue.toLocaleString();
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${accentBorderClasses[color]} p-5 transition-all duration-500 hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${bgColorClasses[color]} ${
        isVisible
          ? 'opacity-100 transform translate-y-0'
          : 'opacity-0 transform translate-y-4'
      }`}
      style={{
        animationDelay: '0.1s',
        animationFillMode: 'forwards',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1.5 truncate">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight transition-all duration-300">
            {getDisplayValue()}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>
          )}
        </div>
        <div
          className={`p-2.5 rounded-lg ${colorClasses[color]} transition-transform duration-300 hover:scale-110`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
