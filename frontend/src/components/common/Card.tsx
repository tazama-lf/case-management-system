import React from 'react';

interface CardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  hoverColor: string;
  onClick: () => void;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  title,
  description,
  icon: Icon,
  iconColor,
  bgColor,
  hoverColor,
  onClick,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-gray-300 ${hoverColor} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
    >
      {/* Icon Section */}
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-lg ${bgColor} mb-6`}>
        <Icon className={`h-8 w-8 ${iconColor}`} />
      </div>

      {/* Content Section */}
      <div className="text-left">
        <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-gray-800">
          {title}
        </h3>
        <p className="text-gray-600 leading-relaxed mb-4">
          {description}
        </p>
      </div>

      {/* Hover Effect Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-50 opacity-0 group-hover:opacity-50 transition-opacity duration-200 pointer-events-none" />
    </button>
  );
};

export default Card;
