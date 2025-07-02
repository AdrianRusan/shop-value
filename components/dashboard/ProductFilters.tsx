'use client'

import React from 'react';

interface FilterState {
  category: string;
  status: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search: string;
}

interface ProductFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export function ProductFilters({ 
  filters, 
  onFilterChange, 
  viewMode, 
  onViewModeChange 
}: ProductFiltersProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ category: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ status: e.target.value });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortBy: e.target.value });
  };

  const handleSortOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortOrder: e.target.value as 'asc' | 'desc' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Caută produse..."
            value={filters.search}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Category Filter */}
        <div className="flex-shrink-0">
          <select
            value={filters.category}
            onChange={handleCategoryChange}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Toate categoriile</option>
            <option value="electrocasnice">Electrocasnice</option>
            <option value="smartphone">Smartphone</option>
            <option value="laptop">Laptop</option>
            <option value="gaming">Gaming</option>
            <option value="fashion">Fashion</option>
            <option value="sport">Sport</option>
            <option value="casa">Casa & Grădina</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex-shrink-0">
          <select
            value={filters.status}
            onChange={handleStatusChange}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="">Toate</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="flex-shrink-0">
          <select
            value={filters.sortBy}
            onChange={handleSortChange}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="addedAt">Data adăugării</option>
            <option value="currentPrice">Preț curent</option>
            <option value="title">Nume produs</option>
            <option value="brand">Brand</option>
            <option value="priceChangePercentage">Schimbare preț</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="flex-shrink-0">
          <select
            value={filters.sortOrder}
            onChange={handleSortOrderChange}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="desc">Descrescător</option>
            <option value="asc">Crescător</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex-shrink-0 flex border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title="Vedere grilă"
          >
            ⚏
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title="Vedere listă"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      <div className="mt-3 flex flex-wrap gap-2">
        {filters.search && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            Căutare: {filters.search}
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              ✕
            </button>
          </span>
        )}
        {filters.category && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Categorie: {filters.category}
            <button
              onClick={() => onFilterChange({ category: '' })}
              className="ml-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              ✕
            </button>
          </span>
        )}
        {filters.status !== 'active' && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
            Status: {filters.status || 'Toate'}
            <button
              onClick={() => onFilterChange({ status: 'active' })}
              className="ml-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
            >
              ✕
            </button>
          </span>
        )}
      </div>
    </div>
  );
}