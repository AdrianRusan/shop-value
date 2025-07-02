'use client';

import { useEffect, useState } from 'react';
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
  BarElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';
import AdvancedAnalyticsDashboard from '@/components/admin/AdvancedAnalyticsDashboard';

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

interface AnalyticsData {
  timestamp: string;
  timeRange: string;
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    totalProducts: number;
    systemHealth: string;
  };
  userMetrics: {
    total: number;
    active: number;
    new: number;
    growth: number;
    activeRate: number;
  };
  subscriptionMetrics: {
    byPlan: {
      free: number;
      pro: number;
      enterprise: number;
    };
    totalPaid: number;
    conversionRate: number;
    newSubscriptions: number;
    canceledSubscriptions: number;
    churnRate: number;
  };
  productMetrics: {
    total: number;
    active: number;
    new: number;
    averagePerUser: number;
    activeRate: number;
  };
  systemMetrics: {
    health: string;
    scraping: {
      successRate: number;
      totalJobs: number;
      completed: number;
      failed: number;
    };
    errors: number;
    uptime: string;
  };
  revenueMetrics: {
    total: number;
    monthly: number;
    annual: number;
    breakdown: Record<string, number>;
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'advanced'>('overview');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?range=${timeRange}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }
      
      setData(result.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="text-sm text-red-700 dark:text-red-400">
            Error loading dashboard: {error}
          </div>
          <button
            onClick={fetchAnalytics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-yellow-600 dark:text-yellow-400';
      case 'needs attention': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'needs attention': return '🔴';
      default: return '⚪';
    }
  };

  // Chart data
  const subscriptionData = {
    labels: ['Free', 'Pro', 'Enterprise'],
    datasets: [
      {
        data: [
          data.subscriptionMetrics.byPlan.free,
          data.subscriptionMetrics.byPlan.pro,
          data.subscriptionMetrics.byPlan.enterprise
        ],
        backgroundColor: [
          '#9CA3AF',
          '#3B82F6',
          '#8B5CF6'
        ],
        borderWidth: 0
      }
    ]
  };

  const revenueData = {
    labels: Object.keys(data.revenueMetrics.breakdown),
    datasets: [
      {
        label: 'Monthly Revenue (€)',
        data: Object.values(data.revenueMetrics.breakdown),
        backgroundColor: '#10B981',
        borderColor: '#059669',
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            System overview and business metrics
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {activeTab === 'overview' && (
            <>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview Dashboard', icon: '📊' },
            { id: 'advanced', label: 'Advanced Analytics', icon: '🔬' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Last Updated */}
          <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {format(lastUpdated, 'PPpp')}
          </div>

          {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Users
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {data.overview.totalUsers.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📊</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Active Users
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {data.overview.activeUsers.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Monthly Revenue
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    €{data.overview.totalRevenue.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📦</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Products
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {data.overview.totalProducts.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">{getHealthIcon(data.overview.systemHealth)}</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    System Health
                  </dt>
                  <dd className={`text-lg font-medium ${getHealthColor(data.overview.systemHealth)}`}>
                    {data.overview.systemHealth}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Subscription Distribution */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Subscription Distribution
          </h3>
          <div className="h-64">
            <Doughnut 
              data={subscriptionData}
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
        </div>

        {/* Revenue by Plan */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Revenue by Plan
          </h3>
          <div className="h-64">
            <Bar 
              data={revenueData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
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
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Metrics */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            User Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">New Users</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.userMetrics.new}
                <span className={`ml-2 text-sm ${data.userMetrics.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.userMetrics.growth >= 0 ? '+' : ''}{data.userMetrics.growth}%
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Rate</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.userMetrics.activeRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Conversion Rate</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.subscriptionMetrics.conversionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* System Metrics */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            System Performance
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Scraping Success</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.systemMetrics.scraping.successRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Jobs</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.systemMetrics.scraping.totalJobs.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Uptime</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.systemMetrics.uptime}
              </span>
            </div>
          </div>
        </div>

        {/* Product Metrics */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Product Tracking
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">New Products</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.productMetrics.new}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Products</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.productMetrics.activeRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Avg per User</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {Math.round(data.productMetrics.averagePerUser * 10) / 10}
              </span>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Advanced Analytics Tab */}
      {activeTab === 'advanced' && (
        <AdvancedAnalyticsDashboard />
      )}
    </div>
  );
}