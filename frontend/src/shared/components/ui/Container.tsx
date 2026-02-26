import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const getContainerSize = (size: string) => {
  const sizes = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-7xl',
    xl: 'max-w-screen-xl',
    full: 'max-w-full',
  };
  return sizes[size as keyof typeof sizes] || sizes.lg;
};

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  className = '',
}) => (
  <div
    className={`mx-auto px-4 sm:px-6 lg:px-8 ${getContainerSize(size)} ${className}`}
  >
    {children}
  </div>
);

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

const getPaddingClass = (padding: string) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  return paddings[padding as keyof typeof paddings] || paddings.md;
};

const getShadowClass = (shadow: string) => {
  const shadows = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  };
  return shadows[shadow as keyof typeof shadows] || shadows.sm;
};

const getRoundedClass = (rounded: string) => {
  const rounds = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
  };
  return rounds[rounded as keyof typeof rounds] || rounds.lg;
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  shadow = 'sm',
  rounded = 'lg',
}) => (
  <div
    className={`bg-white border border-gray-200 ${getPaddingClass(padding)} ${getShadowClass(shadow)} ${getRoundedClass(rounded)} ${className}`}
  >
    {children}
  </div>
);

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <div className={`min-h-screen bg-gray-50 ${className}`}>
    <Container>
      {(title || subtitle || actions) && (
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              )}
              {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
            </div>
            {actions && (
              <div className="flex items-center space-x-3">{actions}</div>
            )}
          </div>
        </div>
      )}
      <div className="pb-6">{children}</div>
    </Container>
  </div>
);

interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <div className={`space-y-6 ${className}`}>
    {(title || subtitle || actions) && (
      <div className="flex items-center justify-between">
        <div>
          {title && (
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          )}
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center space-x-3">{actions}</div>
        )}
      </div>
    )}
    {children}
  </div>
);

export default Container;
