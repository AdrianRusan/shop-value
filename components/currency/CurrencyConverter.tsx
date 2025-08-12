'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  StarIcon,
  GlobeAltIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { debounce } from 'lodash';

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
  regions: string[];
}

interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  timestamp: Date;
  formatted: string;
}

interface CurrencyConverterProps {
  defaultFromCurrency?: string;
  defaultToCurrency?: string;
  defaultAmount?: number;
  onConversion?: (result: ConversionResult) => void;
  compact?: boolean;
  showTrends?: boolean;
  className?: string;
}

export function CurrencyConverter({
  defaultFromCurrency = 'USD',
  defaultToCurrency = 'EUR',
  defaultAmount = 100,
  onConversion,
  compact = false,
  showTrends = true,
  className = '',
}: CurrencyConverterProps) {
  const [fromCurrency, setFromCurrency] = useState(defaultFromCurrency);
  const [toCurrency, setToCurrency] = useState(defaultToCurrency);
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['USD', 'EUR', 'GBP', 'JPY']);

  // Fetch available currencies
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        setIsLoadingCurrencies(true);
        setFetchError(null);
        
        const response = await fetch('/api/currency?action=currencies');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setCurrencies(data.data.currencies);
          setFetchError(null);
        } else {
          throw new Error(data.error?.message || 'Failed to fetch currencies');
        }
      } catch (error) {
        console.error('Failed to fetch currencies:', error);
        setFetchError(error instanceof Error ? error.message : 'Unable to load currencies. Please check your connection and try again.');
        setCurrencies([]); // Safe fallback to empty array
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    fetchCurrencies();
  }, []);

  // Retry function for currency fetching
  const retryCurrencyFetch = useCallback(() => {
    const fetchCurrencies = async () => {
      try {
        setIsLoadingCurrencies(true);
        setFetchError(null);
        
        const response = await fetch('/api/currency?action=currencies');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setCurrencies(data.data.currencies);
          setFetchError(null);
        } else {
          throw new Error(data.error?.message || 'Failed to fetch currencies');
        }
      } catch (error) {
        console.error('Failed to fetch currencies:', error);
        setFetchError(error instanceof Error ? error.message : 'Unable to load currencies. Please check your connection and try again.');
        setCurrencies([]); // Safe fallback to empty array
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    fetchCurrencies();
  }, []);

  // Debounced conversion function
  const debouncedConvert = useCallback(
    debounce(async (amt: string, from: string, to: string) => {
      const numAmount = parseFloat(amt);
      
      if (!numAmount || numAmount <= 0 || from === to) {
        if (from === to && numAmount > 0) {
          setConversion({
            from,
            to,
            amount: numAmount,
            result: numAmount,
            rate: 1,
            timestamp: new Date(),
            formatted: `${getCurrencySymbol(to)}${numAmount.toFixed(getCurrencyDecimals(to))}`,
          });
        } else {
          setConversion(null);
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/currency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'convert',
            amount: numAmount,
            from,
            to,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setConversion(data.data);
          onConversion?.(data.data);
        } else {
          setError(data.error?.message || 'Conversion failed');
          setConversion(null);
        }
      } catch (error) {
        console.error('Conversion error:', error);
        setError('Failed to convert currency');
        setConversion(null);
      } finally {
        setLoading(false);
      }
    }, 500),
    [onConversion]
  );

  // Trigger conversion when inputs change
  useEffect(() => {
    if (amount && fromCurrency && toCurrency) {
      debouncedConvert(amount, fromCurrency, toCurrency);
    } else {
      setConversion(null);
      setLoading(false);
    }
  }, [amount, fromCurrency, toCurrency, debouncedConvert]);

  // Filter currencies based on search
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) return currencies;
    
    const query = searchQuery.toLowerCase();
    return currencies.filter(currency =>
      currency.code.toLowerCase().includes(query) ||
      currency.name.toLowerCase().includes(query) ||
      currency.regions.some(region => region.toLowerCase().includes(query))
    );
  }, [currencies, searchQuery]);

  // Get popular and recent currencies
  const popularCurrencies = useMemo(() => {
    return currencies.filter(currency => favorites.includes(currency.code));
  }, [currencies, favorites]);

  // Helper functions
  const getCurrencySymbol = (code: string): string => {
    const currency = currencies.find(c => c.code === code);
    return currency?.symbol || code;
  };

  const getCurrencyDecimals = (code: string): number => {
    const currency = currencies.find(c => c.code === code);
    return currency?.decimals || 2;
  };

  const getCurrencyInfo = (code: string): CurrencyInfo | undefined => {
    return currencies.find(c => c.code === code);
  };

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    
    setAmount(sanitized);
  };

  const addToFavorites = (currencyCode: string) => {
    if (!favorites.includes(currencyCode)) {
      const newFavorites = [...favorites, currencyCode];
      setFavorites(newFavorites);
      localStorage.setItem('currency-favorites', JSON.stringify(newFavorites));
    }
  };

  const removeFromFavorites = (currencyCode: string) => {
    const newFavorites = favorites.filter(code => code !== currencyCode);
    setFavorites(newFavorites);
    localStorage.setItem('currency-favorites', JSON.stringify(newFavorites));
  };

  // Load favorites from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('currency-favorites');
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to load currency favorites:', error);
      }
    }
  }, []);

  const CurrencyDropdown = ({ 
    value, 
    onChange, 
    show, 
    onToggle, 
    label 
  }: {
    value: string;
    onChange: (code: string) => void;
    show: boolean;
    onToggle: (show: boolean) => void;
    label: string;
  }) => {
    const selectedCurrency = getCurrencyInfo(value);

    return (
      <div className="relative">
        <button
          onClick={() => onToggle(!show)}
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-2">
            {selectedCurrency && (
              <>
                <span className="text-lg">{selectedCurrency.flag}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedCurrency.code}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {selectedCurrency.name}
                </span>
              </>
            )}
          </div>
          <motion.div
            animate={{ rotate: show ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>

        <AnimatePresence>
          {show && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden"
            >
              {/* Search */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search currencies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {/* Popular currencies */}
                {!searchQuery && popularCurrencies.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                      <StarIcon className="w-3 h-3 mr-1" />
                      Popular
                    </div>
                    {popularCurrencies.map((currency) => (
                      <button
                        key={currency.code}
                        onClick={() => {
                          onChange(currency.code);
                          onToggle(false);
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center space-x-3 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <span className="text-lg">{currency.flag}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {currency.code}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {currency.name}
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {currency.symbol}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* All currencies */}
                <div className="p-2">
                  {!searchQuery && popularCurrencies.length > 0 && (
                    <div className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                      <GlobeAltIcon className="w-3 h-3 mr-1" />
                      All Currencies
                    </div>
                  )}
                  
                  {filteredCurrencies.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => {
                        onChange(currency.code);
                        onToggle(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center space-x-3 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors group"
                    >
                      <span className="text-lg">{currency.flag}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {currency.code}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {currency.name}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-sm text-gray-500">
                          {currency.symbol}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (favorites.includes(currency.code)) {
                              removeFromFavorites(currency.code);
                            } else {
                              addToFavorites(currency.code);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <StarIcon 
                            className={`w-3 h-3 ${
                              favorites.includes(currency.code)
                                ? 'text-yellow-500 fill-current'
                                : 'text-gray-400'
                            }`}
                          />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backdrop */}
        {show && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => onToggle(false)}
          />
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <CalculatorIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Currency Converter
              </h3>
              {!compact && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Real-time currency exchange rates
                </p>
              )}
            </div>
          </div>

          {conversion && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <ClockIcon className="w-4 h-4 mr-1" />
              <span>
                {new Date(conversion.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Currency Loading/Error State */}
        {isLoadingCurrencies && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Loading currencies...</span>
            </div>
          </div>
        )}

        {fetchError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  {fetchError}
                </p>
                <button
                  onClick={retryCurrencyFetch}
                  disabled={isLoadingCurrencies}
                  className="text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-3 py-1 rounded transition-colors disabled:cursor-not-allowed"
                >
                  {isLoadingCurrencies ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Converter */}
        {!isLoadingCurrencies && !fetchError && (
        <div className="space-y-4">
          {/* From Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <CurrencyDropdown
                  value={fromCurrency}
                  onChange={setFromCurrency}
                  show={showFromDropdown}
                  onToggle={setShowFromDropdown}
                  label="From"
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                />
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwapCurrencies}
              className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <ArrowsRightLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* To Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <CurrencyDropdown
                  value={toCurrency}
                  onChange={setToCurrency}
                  show={showToDropdown}
                  onToggle={setShowToDropdown}
                  label="To"
                />
              </div>
              <div className="relative">
                <div className="w-full px-3 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-right font-medium">
                  {loading ? (
                    <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-5 rounded"></div>
                  ) : conversion ? (
                    conversion.result.toFixed(getCurrencyDecimals(toCurrency))
                  ) : (
                    '0.00'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Result Display */}
          {(conversion || error) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              {error ? (
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                  <span className="text-sm">{error}</span>
                </div>
              ) : conversion ? (
                <div className="space-y-2">
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    <span className="text-sm font-medium">Conversion Successful</span>
                  </div>
                  
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {conversion.formatted}
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    1 {conversion.from} = {conversion.rate.toFixed(4)} {conversion.to}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </div>
        )}
      </div>
    </div>
  );
} 