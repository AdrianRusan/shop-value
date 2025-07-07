'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface SearchSuggestion {
  type: 'brand' | 'product' | 'popular';
  text: string;
  label: string;
  brand?: string;
  category: string;
}

interface SearchBarWithAutocompleteProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  showClearButton?: boolean;
}

const SearchBarWithAutocomplete: React.FC<SearchBarWithAutocompleteProps> = ({
  onSearch,
  placeholder = "Căutați produse, branduri...",
  className = "",
  showClearButton = true
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search function
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }
      
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to load suggestions');
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous debounce timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce timeout (300ms as specified)
    debounceRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    if (onSearch) {
      onSearch(suggestion.text);
    } else {
      // Default behavior: navigate to search results
      router.push(`/produse?search=${encodeURIComponent(suggestion.text)}`);
    }
  };

  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      setIsOpen(false);
      setSelectedIndex(-1);
      
      if (onSearch) {
        onSearch(query.trim());
      } else {
        // Default behavior: navigate to search results
        router.push(`/produse?search=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  // Handle clear button
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setError(null);
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Group suggestions by category
  const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
    const category = suggestion.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(suggestion);
    return acc;
  }, {} as Record<string, SearchSuggestion[]>);

  return (
    <div className={`relative w-full max-w-2xl mx-auto ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon 
            className="h-5 w-5 text-gray-400" 
            aria-hidden="true"
          />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-12 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors shadow-sm hover:shadow-md touch-manipulation"
          aria-label="Search for products"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-describedby={error ? 'search-error' : undefined}
          autoComplete="off"
          role="combobox"
        />
        
        {/* Loading spinner or clear button */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {isLoading ? (
            <div className="animate-spin h-5 w-5 text-gray-400" aria-label="Loading suggestions">
              <svg className="w-full h-full" viewBox="0 0 24 24">
                <circle 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4" 
                  fill="none" 
                  className="opacity-25" 
                />
                <path 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                />
              </svg>
            </div>
          ) : showClearButton && query ? (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
              type="button"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div 
          id="search-error" 
          className="mt-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Search suggestions"
        >
          {Object.entries(groupedSuggestions).map(([category, categorySuggestions]) => (
            <div key={category}>
              {/* Category Header */}
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-gray-600">
                {category}
              </div>
              
              {/* Category Suggestions */}
              {categorySuggestions.map((suggestion, index) => {
                const globalIndex = suggestions.indexOf(suggestion);
                const isSelected = selectedIndex === globalIndex;
                
                return (
                  <button
                    key={`${suggestion.type}-${suggestion.text}`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-slate-700 focus:bg-gray-100 dark:focus:bg-slate-700 focus:outline-none transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {suggestion.label}
                        </div>
                        {suggestion.brand && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {suggestion.brand}
                          </div>
                        )}
                      </div>
                      
                      {/* Type indicator */}
                      <div className="ml-2 flex-shrink-0">
                        {suggestion.type === 'popular' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            Popular
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBarWithAutocomplete;