import { useState, useMemo } from 'react';
import MultiSelectFilter from './MultiSelectFilter';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterColumn {
  key: string;
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

interface MultiColumnFilterProps {
  columns: FilterColumn[];
  className?: string;
}

export default function MultiColumnFilter({
  columns,
  className = ''
}: MultiColumnFilterProps) {
  const activeFiltersCount = columns.reduce((count, col) => {
    return count + (col.selectedValues.length < col.options.length ? 1 : 0);
  }, 0);

  const clearAllFilters = () => {
    columns.forEach(col => {
      col.onChange(col.options.map(opt => opt.value));
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-primary-600 hover:text-primary-500 font-medium"
          >
            Clear all filters ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* Filter Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {columns.map((column) => (
          <div key={column.key} className="relative">
            <MultiSelectFilter
              options={column.options}
              selectedValues={column.selectedValues}
              onChange={column.onChange}
              label={column.label}
              placeholder={`Select ${column.label.toLowerCase()}...`}
            />
            {column.selectedValues.length < column.options.length && (
              <div className="absolute -top-2 -right-2 h-3 w-3 bg-primary-500 rounded-full"></div>
            )}
          </div>
        ))}
      </div>

      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
          <div className="text-sm text-primary-700">
            <span className="font-medium">Active filters:</span>
            <div className="mt-1 space-y-1">
              {columns.map((column) => {
                const isFiltered = column.selectedValues.length < column.options.length;
                if (!isFiltered) return null;
                
                return (
                  <div key={column.key} className="flex items-center text-xs">
                    <span className="font-medium">{column.label}:</span>
                    <span className="ml-1">
                      {column.selectedValues.length === 0 
                        ? 'None selected'
                        : column.selectedValues.length === 1
                          ? column.options.find(opt => opt.value === column.selectedValues[0])?.label || column.selectedValues[0]
                          : `${column.selectedValues.length} selected`
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}