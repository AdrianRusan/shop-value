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
import { Line, Doughnut, Bar, Chart } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';

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

interface CohortData {
  month: string;
  userCount: number;
  currentlyActive: number;
  retentionRate: number;
  basic?: boolean;
}

interface LTVData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    averageLTV: number;
    totalRevenue: number;
    averageLifespan: number;
    churnRate: number;
    projectedAnnualRevenue: number;
  };
  byPlan: Record<string, any>;
  cohorts: any[];
  detailed: boolean;
  calculatedAt: string;
}

interface ETLStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export default function AdvancedAnalyticsDashboard() {
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [ltvData, setLtvData] = useState<LTVData | null>(null);
  const [etlStatus, setETLStatus] = useState<ETLStatus | null>(null);
  const [loading, setLoading] = useState({
    cohorts: false,
    ltv: false,
    etl: false
  });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cohorts' | 'ltv' | 'reports' | 'etl'>('cohorts');

  // Fetch cohort data
  const fetchCohortData = async (refresh = false) => {
    try {
      setLoading(prev => ({ ...prev, cohorts: true }));
      const response = await fetch(`/api/admin/analytics/cohorts?refresh=${refresh}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch cohort data');
      }
      
      setCohortData(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, cohorts: false }));
    }
  };

  // Fetch LTV data
  const fetchLTVData = async (refresh = false, detailed = false) => {
    try {
      setLoading(prev => ({ ...prev, ltv: true }));
      const response = await fetch(`/api/admin/analytics/ltv?refresh=${refresh}&detailed=${detailed}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch LTV data');
      }
      
      setLtvData(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, ltv: false }));
    }
  };

  // Fetch ETL status
  const fetchETLStatus = async () => {
    try {
      setLoading(prev => ({ ...prev, etl: true }));
      const response = await fetch('/api/admin/analytics/etl/status');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ETL status');
      }
      
      setETLStatus(result.data);
    } catch (err: any) {
      console.error('Failed to fetch ETL status:', err);
    } finally {
      setLoading(prev => ({ ...prev, etl: false }));
    }
  };

  // Trigger ETL job
  const triggerETLJob = async (jobType: string) => {
    try {
      const response = await fetch(`/api/admin/analytics/${jobType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: true })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to trigger ETL job');
      }
      
      alert(`${jobType} job has been scheduled successfully!`);
      fetchETLStatus(); // Refresh ETL status
    } catch (err: any) {
      alert(`Failed to trigger ${jobType} job: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchCohortData();
    fetchLTVData();
    fetchETLStatus();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchETLStatus();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Prepare chart data
  const cohortChartData = {
    labels: cohortData.map(d => d.month),
    datasets: [
      {
        label: 'New Users',
        data: cohortData.map(d => d.userCount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      },
      {
        label: 'Retention Rate (%)',
        data: cohortData.map(d => d.retentionRate),
        type: 'line' as const,
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        yAxisID: 'y1'
      }
    ]
  };

  const ltvByPlanData = ltvData ? {
    labels: Object.keys(ltvData.byPlan),
    datasets: [
      {
        label: 'Average LTV (€)',
        data: Object.values(ltvData.byPlan).map((plan: any) => plan.averageLTV),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  } : null;

  const ltvCohortTrendData = ltvData ? {
    labels: ltvData.cohorts.map(c => c.month),
    datasets: [
      {
        label: 'Average LTV (€)',
        data: ltvData.cohorts.map(c => c.averageLTV),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        tension: 0.1
      }
    ]
  } : null;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="text-red-700 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={() => {
            setError(null);
            fetchCohortData();
            fetchLTVData();
          }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Advanced Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Business intelligence and user behavior insights
          </p>
        </div>
        
        {/* ETL Status Indicator */}
        {etlStatus && (
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">ETL Queue:</span>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {etlStatus.active} active
            </span>
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
              {etlStatus.waiting} waiting
            </span>
            {etlStatus.failed > 0 && (
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
                {etlStatus.failed} failed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'cohorts', label: 'Cohort Analysis', icon: '📊' },
            { id: 'ltv', label: 'Customer LTV', icon: '💰' },
            { id: 'reports', label: 'Reports', icon: '📈' },
            { id: 'etl', label: 'ETL Management', icon: '⚙️' }
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
      <div className="mt-6">
        {/* Cohort Analysis Tab */}
        {activeTab === 'cohorts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                User Cohort Analysis
              </h3>
              <button
                onClick={() => fetchCohortData(true)}
                disabled={loading.cohorts}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading.cohorts ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            {/* Cohort Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Total Cohorts
                </h4>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {cohortData.length}
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Avg Retention Rate
                </h4>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {cohortData.length > 0 
                    ? Math.round(cohortData.reduce((sum, c) => sum + c.retentionRate, 0) / cohortData.length)
                    : 0}%
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Total Users
                </h4>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {cohortData.reduce((sum, c) => sum + c.userCount, 0)}
                </p>
              </div>
            </div>

            {/* Cohort Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Cohort Trends Over Time
              </h4>
                             {cohortData.length > 0 ? (
                 <div className="h-64">
                   <Chart 
                     type="bar"
                     data={cohortChartData}
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
                           type: 'linear',
                           display: true,
                           position: 'left',
                         },
                         y1: {
                           type: 'linear',
                           display: true,
                           position: 'right',
                           grid: {
                             drawOnChartArea: false,
                           },
                         },
                       },
                     }}
                   />
                 </div>
               ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No cohort data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* LTV Analysis Tab */}
        {activeTab === 'ltv' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Customer Lifetime Value Analysis
              </h3>
              <div className="space-x-2">
                <button
                  onClick={() => fetchLTVData(false, true)}
                  disabled={loading.ltv}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Detailed View
                </button>
                <button
                  onClick={() => fetchLTVData(true)}
                  disabled={loading.ltv}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading.ltv ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
            </div>

            {ltvData && (
              <>
                {/* LTV Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Average LTV
                    </h4>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      €{ltvData.summary.averageLTV}
                    </p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Total Revenue
                    </h4>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      €{ltvData.summary.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Avg Lifespan
                    </h4>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {ltvData.summary.averageLifespan} mo
                    </p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Churn Rate
                    </h4>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {ltvData.summary.churnRate}%
                    </p>
                  </div>
                </div>

                {/* LTV Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LTV by Plan */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      LTV by Subscription Plan
                    </h4>
                    {ltvByPlanData && (
                      <div className="h-64">
                        <Doughnut 
                          data={ltvByPlanData}
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
                    )}
                  </div>

                  {/* LTV Cohort Trends */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      LTV Trends by Cohort
                    </h4>
                    {ltvCohortTrendData && (
                      <div className="h-64">
                        <Line 
                          data={ltvCohortTrendData}
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
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Business Intelligence Reports
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Daily Performance Report', desc: 'Daily metrics and KPIs', action: 'daily' },
                { title: 'Weekly Business Summary', desc: 'Weekly trends and insights', action: 'weekly' },
                { title: 'Monthly Revenue Analysis', desc: 'Monthly revenue breakdown', action: 'monthly' },
                { title: 'User Behavior Report', desc: 'User engagement patterns', action: 'behavior' },
                { title: 'Product Analytics', desc: 'Product tracking insights', action: 'products' },
                { title: 'System Health Report', desc: 'Technical performance metrics', action: 'system' }
              ].map((report) => (
                <div key={report.action} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {report.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {report.desc}
                  </p>
                  <button
                    onClick={() => triggerETLJob('generate_reports')}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Generate Report
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETL Management Tab */}
        {activeTab === 'etl' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              ETL Process Management
            </h3>
            
            {/* ETL Status */}
            {etlStatus && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Queue Status
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{etlStatus.active}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">{etlStatus.waiting}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Waiting</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{etlStatus.completed}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{etlStatus.failed}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                  </div>
                </div>
              </div>
            )}

            {/* ETL Job Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Process Daily Metrics', action: 'process_daily_metrics', desc: 'Calculate daily business metrics' },
                { title: 'Calculate Cohorts', action: 'cohorts', desc: 'Run cohort analysis for all users' },
                { title: 'Compute LTV', action: 'ltv', desc: 'Calculate customer lifetime values' },
                { title: 'Aggregate Revenue', action: 'aggregate_revenue', desc: 'Process revenue data aggregation' },
                { title: 'Generate Reports', action: 'generate_reports', desc: 'Create comprehensive reports' },
                { title: 'Clean Old Data', action: 'clean_old_data', desc: 'Remove old analytics data' }
              ].map((job) => (
                <div key={job.action} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {job.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {job.desc}
                  </p>
                  <button
                    onClick={() => triggerETLJob(job.action)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Run Job
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}