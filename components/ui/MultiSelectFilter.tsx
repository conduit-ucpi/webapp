import { useState, useRef, useEffect } from 'react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterProps {
  options: FilterOption[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  label: string;
  placeholder?: string;
  className?: string;
}

export default function MultiSelectFilter({
  options,
  selectedValues,
  onChange,
  label,
  placeholder = 'Select options...',
  className = ''
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(option => option.value));
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option?.label || selectedValues[0];
    }
    if (selectedValues.length === options.length) return 'All statuses';
    return `${selectedValues.length} statuses selected`;
  };

  const allSelected = selectedValues.length === options.length;
  const someSelected = selectedValues.length > 0 && selectedValues.length < options.length;

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        >
          <span className="block truncate">{getDisplayText()}</span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
            {/* Select All Option */}
            <div className="border-b border-gray-200 pb-1 mb-1">
              <div
                onClick={handleSelectAll}
                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-primary-50"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={() => {}} // Handled by onClick
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 block font-medium text-gray-900">
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual Options */}
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleOptionToggle(option.value)}
                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-primary-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option.value)}
                      onChange={() => {}} // Handled by onClick
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 block text-gray-900">
                      {option.label}
                    </span>
                  </div>
                  {option.count !== undefined && (
                    <span className="text-gray-500 text-sm">({option.count})</span>
                  )}
                </div>
              </div>
            ))}

            {options.length === 0 && (
              <div className="relative py-2 pl-3 pr-9 text-gray-500">
                No options available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}