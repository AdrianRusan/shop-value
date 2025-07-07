'use client'

import React, { useState, useEffect } from 'react';
import { ChartBarIcon, MagnifyingGlassIcon, ClockIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline';

interface SearchMetrics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  clickThroughRate: number;
  conversionRate: number;
  popularQueries: Array<{ query: string; count: number }>;
  popularFilters: Array<{ filter: string; count: number }>;
  noResultsQueries: Array<{ query: string; count: number }>;
}

interface SearchInsights {
  lowPerformingQueries: Array<{ query: string; avgResponseTime: number }>;
  suggestions: string[];
}

const SearchAnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [insights, setInsights] = useState<SearchInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsResponse, insightsResponse] = await Promise.all([
        fetch(`/api/search/analytics?start=${dateRange.start}&end=${dateRange.end}&type=metrics`),
        fetch(`/api/search/analytics?start=${dateRange.start}&end=${dateRange.end}&type=insights`)
      ]);

      if (!metricsResponse.ok || !insightsResponse.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const [metricsData, insightsData] = await Promise.all([
        metricsResponse.json(),
        insightsResponse.json()
      ]);

      setMetrics(metricsData);
      setInsights(insightsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Search Analytics Dashboard
          </h1>
          
          {/* Date Range Selector */}
          <div className="flex items-center gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRange((prev: any) => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRange((prev: any) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center">
                <MagnifyingGlassIcon className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Searches</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalSearches.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center">
                <ChartBarIcon className="w-8 h-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unique Users</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.uniqueUsers.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center">
                <ClockIcon className="w-8 h-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.averageResponseTime.toFixed(0)}ms</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center">
                <CursorArrowRaysIcon className="w-8 h-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Click-Through Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.clickThroughRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Popular Queries and Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Popular Queries */}
          {metrics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Popular Search Queries</h3>
              <div className="space-y-3">
                {metrics.popularQueries.slice(0, 10).map((query, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{query.query}</span>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{query.count}</span>
                  </div>
                ))}
                {metrics.popularQueries.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No search data available</p>
                )}
              </div>
            </div>
          )}

          {/* No Results Queries */}
          {metrics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Queries with No Results</h3>
              <div className="space-y-3">
                {metrics.noResultsQueries.slice(0, 10).map((query, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{query.query}</span>
                    <span className="text-sm font-medium text-red-500">{query.count}</span>
                  </div>
                ))}
                {metrics.noResultsQueries.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No queries without results</p>
                )}
              </div>
            </div>
          )}

          {/* Performance Issues */}
          {insights && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Issues</h3>
              <div className="space-y-3">
                {insights.lowPerformingQueries.slice(0, 10).map((query, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{query.query}</span>
                    <span className="text-sm font-medium text-orange-500">{query.avgResponseTime.toFixed(0)}ms</span>
                  </div>
                ))}
                {insights.lowPerformingQueries.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No performance issues detected</p>
                )}
              </div>
            </div>
          )}

          {/* Optimization Suggestions */}
          {insights && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Optimization Suggestions</h3>
              <div className="space-y-3">
                                 {insights.suggestions.map((suggestion: string, index: number) => (
                  <div key={index} className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-gray-700 dark:text-gray-300">{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Popular Filters */}
        {metrics && metrics.popularFilters.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Popular Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.popularFilters.map((filter, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{filter.filter}</span>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{filter.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchAnalyticsDashboard;