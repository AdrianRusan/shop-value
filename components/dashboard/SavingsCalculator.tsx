'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import FormatPrices from '@/components/FormatPrices';

interface TrackedProduct {
  _id: string;
  userId: string;
  productId: {
    _id: string;
    title: string;
    brand: string;
    category: string;
    currentPrice: number;
    originalPrice: number;
    currency: string;
    priceHistory: Array<{
      price: number;
      date: Date;
    }>;
    lastScrapedAt: Date;
  };
  addedAt: Date;
  isActive: boolean;
}

interface SavingsData {
  totalSavings: number;
  totalSpent: number;
  totalOriginalValue: number;
  averageDiscountPercentage: number;
  potentialSavings: number;
  biggestSavingProduct: {
    title: string;
    savings: number;
    percentage: number;
  } | null;
  savingsByCategory: Array<{
    category: string;
    savings: number;
    count: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    savings: number;
  }>;
  currency: string;
}

export function SavingsCalculator() {
  const { user } = useUser();
  const [savingsData, setSavingsData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch tracked products and calculate savings
  const calculateSavings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/products/user/${user.id}?limit=1000&status=active`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      const products: TrackedProduct[] = data.data?.products || [];

      if (products.length === 0) {
        setSavingsData({
          totalSavings: 0,
          totalSpent: 0,
          totalOriginalValue: 0,
          averageDiscountPercentage: 0,
          potentialSavings: 0,
          biggestSavingProduct: null,
          savingsByCategory: [],
          monthlyTrend: [],
          currency: 'RON'
        });
        return;
      }

      // Calculate metrics
      let totalSavings = 0;
      let totalSpent = 0;
      let totalOriginalValue = 0;
      let biggestSaving = { title: '', savings: 0, percentage: 0 };
      const categoryData: Record<string, { savings: number; count: number }> = {};
      const monthlyData: Record<string, number> = {};

      // Get the primary currency from the first product
      const primaryCurrency = products[0]?.productId?.currency || 'RON';

      products.forEach(item => {
        const product = item.productId;
        const savings = product.originalPrice - product.currentPrice;
        const savingsPercentage = product.originalPrice > 0 ? (savings / product.originalPrice) * 100 : 0;

        totalSavings += savings;
        totalSpent += product.currentPrice;
        totalOriginalValue += product.originalPrice;

        // Track biggest saving
        if (savings > biggestSaving.savings) {
          biggestSaving = {
            title: product.title,
            savings: savings,
            percentage: savingsPercentage
          };
        }

        // Category breakdown
        const category = product.category || 'Necategorisit';
        if (!categoryData[category]) {
          categoryData[category] = { savings: 0, count: 0 };
        }
        categoryData[category].savings += savings;
        categoryData[category].count += 1;

        // Monthly trend (last 6 months)
        const addedDate = new Date(item.addedAt);
        const monthKey = addedDate.toLocaleDateString('ro-RO', { 
          month: 'short', 
          year: 'numeric' 
        });
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = 0;
        }
        monthlyData[monthKey] += savings;
      });

      // Calculate potential future savings (based on historical data)
      let potentialSavings = 0;
      products.forEach(item => {
        const priceHistory = item.productId.priceHistory || [];
        if (priceHistory.length > 1) {
          const prices = priceHistory.map(h => h.price);
          const minHistoricalPrice = Math.min(...prices);
          const currentPrice = item.productId.currentPrice;
          const potentialSaving = Math.max(0, currentPrice - minHistoricalPrice);
          potentialSavings += potentialSaving;
        }
      });

      // Format data
      const savingsByCategory = Object.entries(categoryData)
        .map(([category, data]) => ({
          category,
          savings: data.savings,
          count: data.count
        }))
        .sort((a, b) => b.savings - a.savings);

      // Convert month strings back to dates for proper chronological sorting
      const monthlyTrend = Object.entries(monthlyData)
        .map(([month, savings]) => {
          // Parse the Romanian month string back to a date for sorting
          // month format is like "ian. 2024", "feb. 2024", etc.
          const [monthName, year] = month.split(' ');
          const monthMap: { [key: string]: number } = {
            'ian.': 0, 'feb.': 1, 'mar.': 2, 'apr.': 3, 'mai': 4, 'iun.': 5,
            'iul.': 6, 'aug.': 7, 'sep.': 8, 'oct.': 9, 'nov.': 10, 'dec.': 11
          };
          const monthIndex = monthMap[monthName] ?? 0;
          const dateForSorting = new Date(parseInt(year), monthIndex, 1);
          
          return { 
            month, 
            savings, 
            dateForSorting 
          };
        })
        .sort((a, b) => a.dateForSorting.getTime() - b.dateForSorting.getTime()) // Sort chronologically
        .slice(-6) // Take the last 6 months chronologically
        .map(({ month, savings }) => ({ month, savings })); // Remove the helper date

      const averageDiscountPercentage = totalOriginalValue > 0 
        ? (totalSavings / totalOriginalValue) * 100 
        : 0;

      setSavingsData({
        totalSavings,
        totalSpent,
        totalOriginalValue,
        averageDiscountPercentage,
        potentialSavings,
        biggestSavingProduct: biggestSaving.savings > 0 ? biggestSaving : null,
        savingsByCategory,
        monthlyTrend,
        currency: primaryCurrency
      });

    } catch (error) {
      console.error('Error calculating savings:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      await calculateSavings();
      setLoading(false);
    };

    loadData();
  }, [calculateSavings]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await calculateSavings();
    setRefreshing(false);
  }, [calculateSavings]);

  // Memoized calculations for display
  const displayData = useMemo(() => {
    if (!savingsData) return null;

    return {
      ...savingsData,
      savingsRate: savingsData.totalOriginalValue > 0 
        ? ((savingsData.totalSavings / savingsData.totalOriginalValue) * 100).toFixed(1)
        : '0',
      effectiveSpending: ((savingsData.totalSpent / (savingsData.totalOriginalValue || 1)) * 100).toFixed(1)
    };
  }, [savingsData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Calculează economiile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="text-center py-8">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <p className="font-semibold">Eroare la calcularea economiilor</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Încearcă din nou
          </button>
        </div>
      </div>
    );
  }

  if (!displayData) return null;

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Calculatorul de Economii
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Actualizează statisticile"
        >
          <svg 
            className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Main savings metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Savings */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Economii Totale</p>
              <p className="text-2xl font-bold">
                <FormatPrices num={displayData.totalSavings} /> {displayData.currency}
              </p>
              <p className="text-green-100 text-xs mt-1">
                {displayData.savingsRate}% economisiți
              </p>
            </div>
            <div className="bg-green-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Average Discount */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Reducere Medie</p>
              <p className="text-2xl font-bold">
                {displayData.averageDiscountPercentage.toFixed(1)}%
              </p>
              <p className="text-blue-100 text-xs mt-1">
                per produs urmărit
              </p>
            </div>
            <div className="bg-blue-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Potential Savings */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Economii Potențiale</p>
              <p className="text-2xl font-bold">
                <FormatPrices num={displayData.potentialSavings} /> {displayData.currency}
              </p>
              <p className="text-purple-100 text-xs mt-1">
                la prețurile minime
              </p>
            </div>
            <div className="bg-purple-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Spent */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Cheltuielile Tale</p>
              <p className="text-2xl font-bold">
                <FormatPrices num={displayData.totalSpent} /> {displayData.currency}
              </p>
              <p className="text-orange-100 text-xs mt-1">
                {displayData.effectiveSpending}% din original
              </p>
            </div>
            <div className="bg-orange-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM4 13a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Additional insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biggest Saving Product */}
        {displayData.biggestSavingProduct && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cea Mai Mare Economie
            </h4>
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white line-clamp-2">
                  {displayData.biggestSavingProduct.title}
                </p>
                <div className="flex items-center mt-2 space-x-4">
                  <span className="text-green-600 dark:text-green-400 font-bold">
                    -<FormatPrices num={displayData.biggestSavingProduct.savings} /> {displayData.currency}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({displayData.biggestSavingProduct.percentage.toFixed(1)}% reducere)
                  </span>
                </div>
              </div>
              <div className="text-green-600 dark:text-green-400">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Savings by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Economii pe Categorii
          </h4>
          <div className="space-y-3">
            {displayData.savingsByCategory.slice(0, 5).map((category: { category: string; savings: number; count: number }, index: number) => (
              <div key={category.category} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    index === 0 ? 'bg-green-500' :
                    index === 1 ? 'bg-blue-500' :
                    index === 2 ? 'bg-purple-500' :
                    index === 3 ? 'bg-orange-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {category.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({category.count} produse)
                  </span>
                </div>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  <FormatPrices num={category.savings} /> {displayData.currency}
                </span>
              </div>
            ))}
            {displayData.savingsByCategory.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                Nu sunt disponibile date pentru categorii
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary insights */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Rezumatul Economiilor
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Valoarea Originală</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              <FormatPrices num={displayData.totalOriginalValue} /> {displayData.currency}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Ai Plătit Efectiv</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              <FormatPrices num={displayData.totalSpent} /> {displayData.currency}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Economii Realizate</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              <FormatPrices num={displayData.totalSavings} /> {displayData.currency}
            </p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Prin urmărirea prețurilor, ai economisit <strong>{displayData.savingsRate}%</strong> din valoarea totală!
          </p>
        </div>
      </div>
    </div>
  );
}