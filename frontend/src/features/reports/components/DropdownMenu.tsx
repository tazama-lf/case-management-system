interface DropdownOption<T = string> {
  value: T;
  label: string;
}

interface DropdownMenuProps<T = string> {
  isOpen: boolean;
  options: DropdownOption<T>[];
  onSelect: (value: T) => void;
  className?: string;
}

const DropdownMenu = <T extends string>({
  isOpen,
  options,
  onSelect,
  className = ''
}: DropdownMenuProps<T>) => {
  if (!isOpen) return null;

  return (
    <div className={`absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg ${className}`}>
      <ul className="py-1 text-sm text-gray-700">
        {options.map(({ value, label }) => (
          <li key={value}>
            <button
              onClick={() => onSelect(value)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DropdownMenu;