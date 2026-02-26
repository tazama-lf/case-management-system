import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
}) => (
  <div className="relative">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
    </div>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
    />
  </div>
);

export default SearchInput;
