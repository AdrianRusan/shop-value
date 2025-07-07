'use client'

import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface FilterState {
  priceRange: [number, number];
  brands: string[];
  categories: string[];
  availability: string[];
  discount: [number, number];
  dateRange: {
    start: string;
    end: string;
  };
  sortBy: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  isOpen,
  onToggle,
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    price: true,
    brands: true,
    categories: true,
    availability: false,
    discount: false,
    date: false,
    sort: true
  });

  // Available filter options (would typically come from API)
  const filterOptions = {
    brands: ['Samsung', 'Apple', 'Huawei', 'Xiaomi', 'OnePlus', 'Google', 'Sony', 'Nokia', 'Motorola'],
    categories: ['Telefoane', 'Laptopuri', 'Tablete', 'Accesorii', 'Smartwatch', 'Căști', 'Boxe', 'Gaming'],
    availability: ['În stoc', 'Stoc limitat', 'Precomandă', 'Indisponibil'],
    sortOptions: [
      { value: 'relevance', label: 'Relevanță' },
      { value: 'price_asc', label: 'Preț crescător' },
      { value: 'price_desc', label: 'Preț descrescător' },
      { value: 'newest', label: 'Cele mai noi' },
      { value: 'popularity', label: 'Popularitate' },
      { value: 'discount', label: 'Reducere mare' }
    ]
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleArrayFilter = (key: 'brands' | 'categories' | 'availability', value: string) => {
    const currentValues = filters[key];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(item => item !== value)
      : [...currentValues, value];
    
    updateFilter(key, newValues);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      priceRange: [0, 10000],
      brands: [],
      categories: [],
      availability: [],
      discount: [0, 100],
      dateRange: { start: '', end: '' },
      sortBy: 'relevance'
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.brands.length > 0 ||
      filters.categories.length > 0 ||
      filters.availability.length > 0 ||
      filters.priceRange[0] > 0 ||
      filters.priceRange[1] < 10000 ||
      filters.discount[0] > 0 ||
      filters.discount[1] < 100 ||
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.sortBy !== 'relevance'
    );
  };

  const FilterSection: React.FC<{
    title: string;
    sectionKey: string;
    children: React.ReactNode;
    count?: number;
  }> = ({ title, sectionKey, children, count }) => {
    const isExpanded = expandedSections[sectionKey];
    
    return (
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            {title}
            {count !== undefined && count > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                {count}
              </span>
            )}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="px-4 pb-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  const PriceSlider: React.FC<{
    min: number;
    max: number;
    values: [number, number];
    onChange: (values: [number, number]) => void;
  }> = ({ min, max, values, onChange }) => {
    const [localValues, setLocalValues] = useState(values);

    useEffect(() => {
      setLocalValues(values);
    }, [values]);

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = Math.min(parseInt(e.target.value), localValues[1]);
      const newValues: [number, number] = [newMin, localValues[1]];
      setLocalValues(newValues);
      onChange(newValues);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = Math.max(parseInt(e.target.value), localValues[0]);
      const newValues: [number, number] = [localValues[0], newMax];
      setLocalValues(newValues);
      onChange(newValues);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Min</label>
            <input
              type="number"
              value={localValues[0]}
              onChange={(e) => setLocalValues([parseInt(e.target.value) || 0, localValues[1]])}
              onBlur={handleMinChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              min={min}
              max={max}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Max</label>
            <input
              type="number"
              value={localValues[1]}
              onChange={(e) => setLocalValues([localValues[0], parseInt(e.target.value) || max])}
              onBlur={handleMaxChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              min={min}
              max={max}
            />
          </div>
        </div>
        <div className="relative">
          <input
            type="range"
            min={min}
            max={max}
            value={localValues[0]}
            onChange={handleMinChange}
            className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          />
          <input
            type="range"
            min={min}
            max={max}
            value={localValues[1]}
            onChange={handleMaxChange}
            className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
          {localValues[0]} RON - {localValues[1]} RON
        </div>
      </div>
    );
  };

  const CheckboxGroup: React.FC<{
    options: string[];
    selected: string[];
    onChange: (value: string) => void;
  }> = ({ options, selected, onChange }) => (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {options.map(option => (
        <label key={option} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onChange(option)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
          <span className="text-xs text-gray-500 dark:text-gray-500 ml-auto">
            ({Math.floor(Math.random() * 100) + 1})
          </span>
        </label>
      ))}
    </div>
  );

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all md:hidden ${className}`}
      >
        <FunnelIcon className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onToggle}
      />
      
      {/* Filter Panel */}
      <div className={`
        fixed md:sticky top-0 right-0 md:right-auto h-full md:h-auto w-80 md:w-full max-w-sm
        bg-white dark:bg-gray-900 shadow-xl md:shadow-none z-50 md:z-auto
        transform transition-transform md:transform-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        ${className}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FunnelIcon className="w-5 h-5" />
            Filtrează rezultatele
          </h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters() && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Șterge tot
              </button>
            )}
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded md:hidden"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div className="overflow-y-auto h-full md:h-auto pb-20 md:pb-0">
          {/* Sort */}
          <FilterSection title="Sortare" sectionKey="sort">
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {filterOptions.sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterSection>

          {/* Price Range */}
          <FilterSection title="Preț" sectionKey="price">
            <PriceSlider
              min={0}
              max={10000}
              values={filters.priceRange}
              onChange={(values) => updateFilter('priceRange', values)}
            />
          </FilterSection>

          {/* Brands */}
          <FilterSection 
            title="Mărci" 
            sectionKey="brands" 
            count={filters.brands.length}
          >
            <CheckboxGroup
              options={filterOptions.brands}
              selected={filters.brands}
              onChange={(value) => toggleArrayFilter('brands', value)}
            />
          </FilterSection>

          {/* Categories */}
          <FilterSection 
            title="Categorii" 
            sectionKey="categories" 
            count={filters.categories.length}
          >
            <CheckboxGroup
              options={filterOptions.categories}
              selected={filters.categories}
              onChange={(value) => toggleArrayFilter('categories', value)}
            />
          </FilterSection>

          {/* Availability */}
          <FilterSection 
            title="Disponibilitate" 
            sectionKey="availability" 
            count={filters.availability.length}
          >
            <CheckboxGroup
              options={filterOptions.availability}
              selected={filters.availability}
              onChange={(value) => toggleArrayFilter('availability', value)}
            />
          </FilterSection>

          {/* Discount Range */}
          <FilterSection title="Reducere (%)" sectionKey="discount">
            <PriceSlider
              min={0}
              max={100}
              values={filters.discount}
              onChange={(values) => updateFilter('discount', values)}
            />
          </FilterSection>

          {/* Date Range */}
          <FilterSection title="Perioada" sectionKey="date">
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Data început
                </label>
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Data sfârșit
                </label>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </FilterSection>
        </div>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </>
  );
};

export default FilterPanel;