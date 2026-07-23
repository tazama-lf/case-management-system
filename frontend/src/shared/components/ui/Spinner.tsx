import React from 'react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
}

const getSpinnerSize = (size: string) => {
  const sizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };
  return sizes[size as keyof typeof sizes] || sizes.md;
};

const getSpinnerColor = (color: string) => {
  const colors = {
    primary: 'border-blue-600',
    secondary: 'border-gray-600',
    white: 'border-white',
    gray: 'border-gray-400',
  };
  return colors[color as keyof typeof colors] || colors.primary;
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => (
  <div
    className={`animate-spin rounded-full border-2 border-t-transparent ${getSpinnerSize(size)} ${getSpinnerColor(color)} ${className}`}
    role="status"
    aria-label="Loading"
  >
    <span className="sr-only">Loading...</span>
  </div>
);

interface DotsSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
}

const getDotSize = (size: string) => {
  const sizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };
  return sizes[size as keyof typeof sizes] || sizes.md;
};

const getDotColor = (color: string) => {
  const colors = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    white: 'bg-white',
    gray: 'bg-gray-400',
  };
  return colors[color as keyof typeof colors] || colors.primary;
};

export const DotsSpinner: React.FC<DotsSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const dotClass = `${getDotSize(size)} ${getDotColor(color)} rounded-full`;

  return (
    <div
      className={`flex space-x-1 ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div
        className={`${dotClass} animate-bounce`}
        style={{ animationDelay: '0ms' }}
      ></div>
      <div
        className={`${dotClass} animate-bounce`}
        style={{ animationDelay: '150ms' }}
      ></div>
      <div
        className={`${dotClass} animate-bounce`}
        style={{ animationDelay: '300ms' }}
      ></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

interface PulseSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
}

const getPulseSize = (size: string) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  return sizes[size as keyof typeof sizes] || sizes.md;
};

const getPulseColor = (color: string) => {
  const colors = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    white: 'bg-white',
    gray: 'bg-gray-400',
  };
  return colors[color as keyof typeof colors] || colors.primary;
};

export const PulseSpinner: React.FC<PulseSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => (
  <div
    className={`animate-pulse rounded-full ${getPulseSize(size)} ${getPulseColor(color)} ${className}`}
    role="status"
    aria-label="Loading"
  >
    <span className="sr-only">Loading...</span>
  </div>
);

interface SpinnerWithTextProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
  spinnerType?: 'spinner' | 'dots' | 'pulse';
}

export const SpinnerWithText: React.FC<SpinnerWithTextProps> = ({
  text = 'Loading...',
  size = 'md',
  color = 'primary',
  className = '',
  spinnerType = 'spinner',
}) => {
  const renderSpinner = () => {
    switch (spinnerType) {
      case 'dots':
        return <DotsSpinner size={size} color={color} />;
      case 'pulse':
        return <PulseSpinner size={size} color={color} />;
      default:
        return <Spinner size={size} color={color} />;
    }
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {renderSpinner()}
      <span className="text-sm text-gray-600">{text}</span>
    </div>
  );
};

export default Spinner;
