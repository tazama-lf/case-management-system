import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface OptionsRendererProps {
  options: Option[];
  placeholder?: string;
}

export const OptionsRenderer: React.FC<OptionsRendererProps> = ({
  options,
  placeholder,
}) => (
  <>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(({ value, label }) => (
      <option key={value || 'empty'} value={value}>
        {label}
      </option>
    ))}
  </>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  placeholder,
  className = '',
  ...props
}) => (
  <select
    className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
    {...props}
  >
    <OptionsRenderer options={options} placeholder={placeholder} />
  </select>
);

export default Select;
