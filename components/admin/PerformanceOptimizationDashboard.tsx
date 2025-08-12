'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  CpuChipIcon,
  ServerIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Cog6ToothIcon,
  PlayIcon,
  PauseIcon,
  LightBulbIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

interface OptimizationRecommendation {
  id: string;
  category: 'caching' | 'database' | 'frontend' | 'network' | 'memory';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  estimatedGain: string;
  implementation: string;
  autoApplicable: boolean;
  timestamp: number;
}

interface DashboardData {
  currentRecommendations: OptimizationRecommendation[];
  appliedOptimizations: OptimizationRecommendation[];
  performanceScore: number;
  trends: any[];
}

interface OptimizationConfig {
  enableAdaptiveCaching: boolean;
  enableQueryOptimization: boolean;
  enablePreloading: boolean;
  enableResourceCompression: boolean;
  enableCDNCaching: boolean;
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  monitoringInterval: number;
}

export function PerformanceOptimizationDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<OptimizationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showConfig, setShowConfig] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Input validation helper
  const validateMonitoringInterval = (value: string): { isValid: boolean; validatedValue?: number; error?: string } => {
    // Parse the input value
    const numValue = parseInt(value, 10);
    
    // Check if parsing was successful and value is a valid number
    if (!Number.isInteger(numValue) || Number.isNaN(numValue)) {
      return { isValid: false, error: 'Please enter a valid number' };
    }
    
    // Define valid range based on HTML attributes
    const minValue = 10000; // 10 seconds
    const maxValue = 300000; // 5 minutes
    const stepValue = 10000; // 10 second increments
    
    // Validate range
    if (numValue < minValue || numValue > maxValue) {
      return { 
        isValid: false, 
        error: `Value must be between ${minValue} and ${maxValue} milliseconds` 
      };
    }
    
    // Validate step (should be divisible by step value)
    if ((numValue - minValue) % stepValue !== 0) {
      return { 
        isValid: false, 
        error: `Value must be in ${stepValue}ms increments (${minValue}, ${minValue + stepValue}, ${minValue + stepValue * 2}, etc.)` 
      };
    }
    
    return { isValid: true, validatedValue: numValue };
  };

  // Handle monitoring interval change with validation
  const handleMonitoringIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const validation = validateMonitoringInterval(inputValue);
    
    if (validation.isValid && validation.validatedValue !== undefined) {
      // Clear any previous validation errors
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.monitoringInterval;
        return newErrors;
      });
      
      // Update config with validated value
      updateConfig({ monitoringInterval: validation.validatedValue });
    } else {
      // Set validation error
      setValidationErrors(prev => ({
        ...prev,
        monitoringInterval: validation.error || 'Invalid input'
      }));
      
      // Optionally revert to previous valid value or set a safe default
      // For now, we won't update the config and let the user correct the input
    }
  };

  // Fetch configuration data
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/performance/optimization/config');
      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
      } else {
        console.error('Failed to fetch configuration:', data.error?.message);
        // Set default config if fetch fails
        setConfig({
          enableAdaptiveCaching: true,
          enableQueryOptimization: true,
          enablePreloading: false,
          enableResourceCompression: true,
          enableCDNCaching: false,
          cacheStrategy: 'balanced',
          monitoringInterval: 30000, // Default to 30 seconds
        });
      }
    } catch (error) {
      console.error('Error fetching configuration:', error);
      // Set default config if fetch fails
      setConfig({
        enableAdaptiveCaching: true,
        enableQueryOptimization: true,
        enablePreloading: false,
        enableResourceCompression: true,
        enableCDNCaching: false,
        cacheStrategy: 'balanced',
        monitoringInterval: 30000, // Default to 30 seconds
      });
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/performance/optimization');
      const data = await response.json();

      if (data.success) {
        setDashboardData(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Trigger optimization analysis
  const triggerAnalysis = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/admin/performance/optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchDashboardData();
      } else {
        setError(data.error?.message || 'Failed to trigger analysis');
      }
    } catch (error) {
      console.error('Error triggering analysis:', error);
      setError('Failed to trigger analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Update configuration
  const updateConfig = async (newConfig: Partial<OptimizationConfig>) => {
    try {
      const response = await fetch('/api/admin/performance/optimization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      const data = await response.json();
      if (data.success) {
        setConfig(data.data.updatedConfig);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to update configuration');
      }
    } catch (error) {
      console.error('Error updating configuration:', error);
      setError('Failed to update configuration');
    }
  };

  // Initialize component
  useEffect(() => {
    fetchDashboardData();
    fetchConfig();

    // Set up auto-refresh
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Filter recommendations by category
  const filteredRecommendations = useMemo(() => {
    if (!dashboardData) return [];
    
    return selectedCategory === 'all' 
      ? dashboardData.currentRecommendations
      : dashboardData.currentRecommendations.filter(rec => rec.category === selectedCategory);
  }, [dashboardData, selectedCategory]);

  // Calculate recommendation statistics
  const recommendationStats = useMemo(() => {
    if (!dashboardData) return { total: 0, critical: 0, high: 0, medium: 0, low: 0, autoApplicable: 0 };

    const recs = dashboardData.currentRecommendations;
    return {
      total: recs.length,
      critical: recs.filter(r => r.priority === 'critical').length,
      high: recs.filter(r => r.priority === 'high').length,
      medium: recs.filter(r => r.priority === 'medium').length,
      low: recs.filter(r => r.priority === 'low').length,
      autoApplicable: recs.filter(r => r.autoApplicable).length,
    };
  }, [dashboardData]);

  // Performance score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircleIcon className="w-6 h-6" />;
    if (score >= 70) return <ClockIcon className="w-6 h-6" />;
    return <ExclamationTriangleIcon className="w-6 h-6" />;
  };

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Category icon mapping
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'caching': return <ServerIcon className="w-5 h-5" />;
      case 'database': return <ChartBarIcon className="w-5 h-5" />;
      case 'frontend': return <CpuChipIcon className="w-5 h-5" />;
      case 'memory': return <ExclamationTriangleIcon className="w-5 h-5" />;
      default: return <Cog6ToothIcon className="w-5 h-5" />;
    }
  };

  // Chart data for performance trends
  const trendChartData = useMemo(() => {
    if (!dashboardData?.trends || dashboardData.trends.length === 0) {
      return null;
    }

    const labels = dashboardData.trends.map((_, index) => 
      new Date(Date.now() - (dashboardData.trends.length - index - 1) * 2 * 60 * 1000).toLocaleTimeString()
    );

    return {
      labels,
      datasets: [
        {
          label: 'Database Query Time (ms)',
          data: dashboardData.trends.map(trend => trend.database?.queryTime || 0),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        },
        {
          label: 'WebSocket Response Time (ms)',
          data: dashboardData.trends.map(trend => trend.websocket?.responseTime || 0),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Memory Usage (%)',
          data: dashboardData.trends.map(trend => trend.application?.memoryUsage || 0),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
        },
      ],
    };
  }, [dashboardData]);

  // Recommendation distribution chart
  const recommendationDistributionData = useMemo(() => {
    if (!dashboardData) return null;

    const categories = ['caching', 'database', 'frontend', 'memory', 'network'];
    const counts = categories.map(cat => 
      dashboardData.currentRecommendations.filter(rec => rec.category === cat).length
    );

    return {
      labels: categories.map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)),
      datasets: [
        {
          data: counts,
          backgroundColor: [
            '#3B82F6',
            '#10B981',
            '#F59E0B',
            '#EF4444',
            '#8B5CF6',
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [dashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
        </div>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Performance Optimization
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and optimize system performance
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {autoRefresh ? <PauseIcon className="w-4 h-4 mr-1" /> : <PlayIcon className="w-4 h-4 mr-1" />}
            Auto-refresh
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Cog6ToothIcon className="w-4 h-4 mr-1" />
            Settings
          </button>

          <button
            onClick={triggerAnalysis}
            disabled={analyzing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <ChartBarIcon className="w-4 h-4 mr-2" />
            )}
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Performance Score Overview */}
      {dashboardData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Overall Performance Score
            </h3>
            <div className={`flex items-center ${getScoreColor(dashboardData.performanceScore)}`}>
              {getScoreIcon(dashboardData.performanceScore)}
              <span className="ml-2 text-3xl font-bold">
                {dashboardData.performanceScore}
              </span>
              <span className="text-sm ml-1">/100</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {recommendationStats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Recommendations</div>
            </div>

            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {recommendationStats.critical + recommendationStats.high}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Critical/High Priority</div>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {dashboardData.appliedOptimizations.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Applied Optimizations</div>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {recommendationStats.autoApplicable}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Auto-Applicable</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Performance Trends Chart */}
      {trendChartData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance Trends
          </h3>
          <div className="h-64">
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommendation Distribution */}
        {recommendationDistributionData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recommendations by Category
            </h3>
            <div className="h-48">
              <Doughnut
                data={recommendationDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </motion.div>
        )}

        {/* Configuration Panel */}
        <AnimatePresence>
          {showConfig && config && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Optimization Configuration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Adaptive Caching
                    </label>
                    <button
                      onClick={() => updateConfig({ enableAdaptiveCaching: !config.enableAdaptiveCaching })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.enableAdaptiveCaching ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.enableAdaptiveCaching ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Query Optimization
                    </label>
                    <button
                      onClick={() => updateConfig({ enableQueryOptimization: !config.enableQueryOptimization })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.enableQueryOptimization ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.enableQueryOptimization ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Resource Preloading
                    </label>
                    <button
                      onClick={() => updateConfig({ enablePreloading: !config.enablePreloading })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.enablePreloading ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.enablePreloading ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cache Strategy
                    </label>
                    <select
                      value={config.cacheStrategy}
                      onChange={(e) => updateConfig({ cacheStrategy: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="conservative">Conservative</option>
                      <option value="balanced">Balanced</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Monitoring Interval (ms)
                    </label>
                    <input
                      type="number"
                      value={config.monitoringInterval}
                      onChange={handleMonitoringIntervalChange}
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                        validationErrors.monitoringInterval 
                          ? 'border-red-500 dark:border-red-400' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      min="10000"
                      max="300000"
                      step="10000"
                    />
                    {validationErrors.monitoringInterval && (
                      <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                        <span>{validationErrors.monitoringInterval}</span>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Valid range: 10,000 - 300,000 ms (10s - 5min) in 10s increments
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recommendations List */}
      {dashboardData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Optimization Recommendations
            </h3>

            <div className="flex items-center space-x-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Categories</option>
                <option value="caching">Caching</option>
                <option value="database">Database</option>
                <option value="frontend">Frontend</option>
                <option value="memory">Memory</option>
                <option value="network">Network</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredRecommendations.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <LightBulbIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No optimization recommendations found</p>
                <p className="text-sm">Your system is performing well!</p>
              </div>
            ) : (
              filteredRecommendations.map((rec) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          {getCategoryIcon(rec.category)}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        {rec.autoApplicable && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-medium">
                            AUTO-APPLICABLE
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {rec.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {rec.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Impact:</span>
                          <span className="ml-1 text-gray-600 dark:text-gray-400">{rec.impact}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Effort:</span>
                          <span className="ml-1 text-gray-600 dark:text-gray-400">{rec.effort}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Estimated Gain:</span>
                          <span className="ml-1 text-gray-600 dark:text-gray-400">{rec.estimatedGain}</span>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-start">
                          <InformationCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Implementation:</span>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.implementation}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(rec.timestamp).toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
} 