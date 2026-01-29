import React, { useEffect, useState } from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'indigo';
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, subtitle }) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const isNumeric = typeof value === 'number';

  const colorClasses = {
    blue: 'bg-blue-500 text-white shadow-blue-100',
    red: 'bg-red-500 text-white shadow-red-100',
    yellow: 'bg-yellow-500 text-white shadow-yellow-100',
    green: 'bg-green-500 text-white shadow-green-100',
    purple: 'bg-purple-500 text-white shadow-purple-100',
    indigo: 'bg-indigo-500 text-white shadow-indigo-100'
  };

  const bgColorClasses = {
    blue: 'hover:bg-blue-50',
    red: 'hover:bg-red-50',
    yellow: 'hover:bg-yellow-50',
    green: 'hover:bg-green-50',
    purple: 'hover:bg-purple-50',
    indigo: 'hover:bg-indigo-50'
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

      return () => clearInterval(timer);
    } else {
      setAnimatedValue(0);
    }
  }, [value, isNumeric]);

  const getDisplayValue = () => {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return '0';
    }
    return animatedValue.toLocaleString();
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-500 hover:shadow-md hover:scale-105 cursor-pointer ${bgColorClasses[color]} ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'
        }`}
      style={{
        animationDelay: '0.1s',
        animationFillMode: 'forwards'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 transition-all duration-300">
            {getDisplayValue()}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]} shadow-lg transition-transform duration-300 hover:scale-110`}>
          {icon}
        </div>
      </div>

      { }
      <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all duration-1000 ease-out`}
          style={{
            width: isVisible ? '100%' : '0%',
            transitionDelay: '0.5s'
          }}
        />
      </div>
    </div>
  );
};

export default StatsCard;
