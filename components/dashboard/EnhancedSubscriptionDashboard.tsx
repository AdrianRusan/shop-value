'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUBSCRIPTION_PLANS } from '@/lib/stripe';
import { 
  CreditCardIcon, 
  ChartBarIcon, 
  BoltIcon, 
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  CurrencyEuroIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface SubscriptionDashboardProps {
  mongoUser: {
    subscription?: {
      plan: 'free' | 'pro' | 'enterprise';
      status: 'active' | 'canceled' | 'past_due' | 'unpaid';
      stripeCustomerId?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    };
    usage?: {
      productsTracked: number;
      maxProducts: number;
      emailsSent: number;
      maxEmails: number;
      apiCallsToday?: number;
      maxApiCalls?: number;
      lastUsageReset?: string;
    };
  } | null;
  className?: string;
}

interface UsageStats {
  productsUsage: { used: number; limit: number; percentage: number };
  emailsUsage: { used: number; limit: number; percentage: number };
  apiUsage: { used: number; limit: number; percentage: number };
  savings: { totalSavings: number; averageSavingsPerProduct: number };
  performance: { averageResponseTime: number; uptime: number };
}

export function EnhancedSubscriptionDashboard({ mongoUser, className = '' }: SubscriptionDashboardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  const currentPlan = mongoUser?.subscription?.plan || 'free';
  const planDetails = SUBSCRIPTION_PLANS[currentPlan];

  // Calculate usage statistics
  const calculatedUsageStats = useMemo((): UsageStats => {
    const usage = mongoUser?.usage || {
      productsTracked: 0,
      maxProducts: 5,
      emailsSent: 0,
      maxEmails: 10,
      apiCallsToday: 0,
      maxApiCalls: 100,
    };

    return {
      productsUsage: {
        used: usage.productsTracked,
        limit: usage.maxProducts,
        percentage: Math.round((usage.productsTracked / usage.maxProducts) * 100),
      },
      emailsUsage: {
        used: usage.emailsSent,
        limit: usage.maxEmails,
        percentage: Math.round((usage.emailsSent / usage.maxEmails) * 100),
      },
      apiUsage: {
        used: usage.apiCallsToday || 0,
        limit: usage.maxApiCalls || 100,
        percentage: Math.round(((usage.apiCallsToday || 0) / (usage.maxApiCalls || 100)) * 100),
      },
      savings: {
        totalSavings: usage.productsTracked * 15.5, // Estimated savings per product
        averageSavingsPerProduct: 15.5,
      },
      performance: {
        averageResponseTime: 245, // ms
        uptime: 99.9, // %
      },
    };
  }, [mongoUser]);

  useEffect(() => {
    setUsageStats(calculatedUsageStats);
  }, [calculatedUsageStats]);

  const handleUpgrade = async (planId: 'pro' | 'enterprise') => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billing: billingCycle,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      } else {
        console.error('Failed to create checkout session:', data.error);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
      });

      if (!response.ok) {
        console.error('Failed to create customer portal session: HTTP', response.status);
        return;
      }

      const data = await response.json();
      
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to create customer portal session: Invalid response data', data);
      }
    } catch (error) {
      console.error('Error creating customer portal session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircleIcon, text: 'Active' },
      canceled: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircleIcon, text: 'Canceled' },
      past_due: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: ExclamationTriangleIcon, text: 'Past Due' },
      unpaid: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: ExclamationTriangleIcon, text: 'Unpaid' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.active;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatPrice = (price: number) => {
    return (price / 100).toFixed(2);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Subscription Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your plan, monitor usage, and track savings
          </p>
        </div>
        
        {currentPlan !== 'free' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleManageSubscription}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <CreditCardIcon className="w-4 h-4 mr-2" />
            Manage Billing
          </motion.button>
        )}
      </div>

      {/* Current Plan Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-blue-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BoltIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {planDetails.name} Plan
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentPlan === 'free' ? 'Free forever' : 'Premium features enabled'}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            {getStatusBadge(mongoUser?.subscription?.status || 'active')}
            {mongoUser?.subscription?.currentPeriodEnd && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {mongoUser.subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                {new Date(mongoUser.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Plan Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <ChartBarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-white">Products</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {planDetails.maxProducts === Infinity ? '∞' : planDetails.maxProducts}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Max trackable products
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <ClockIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-gray-900 dark:text-white">Frequency</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {planDetails.checkFrequency < 24 ? `${planDetails.checkFrequency}h` : `${planDetails.checkFrequency / 24}d`}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Price check interval
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <ShieldCheckIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-gray-900 dark:text-white">Features</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {planDetails.features.length} premium features
            </p>
          </div>
        </div>
      </motion.div>

      {/* Usage Statistics */}
      {usageStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Usage Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Usage Overview
            </h3>
            
            <div className="space-y-4">
              {/* Products Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Products Tracked
                  </span>
                  <span className={`text-sm font-semibold ${getUsageColor(usageStats.productsUsage.percentage)}`}>
                    {usageStats.productsUsage.used} / {usageStats.productsUsage.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usageStats.productsUsage.percentage}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className={`h-2 rounded-full ${getUsageBarColor(usageStats.productsUsage.percentage)}`}
                  />
                </div>
              </div>

              {/* Emails Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Notifications Sent
                  </span>
                  <span className={`text-sm font-semibold ${getUsageColor(usageStats.emailsUsage.percentage)}`}>
                    {usageStats.emailsUsage.used} / {usageStats.emailsUsage.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usageStats.emailsUsage.percentage}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className={`h-2 rounded-full ${getUsageBarColor(usageStats.emailsUsage.percentage)}`}
                  />
                </div>
              </div>

              {/* API Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    API Calls Today
                  </span>
                  <span className={`text-sm font-semibold ${getUsageColor(usageStats.apiUsage.percentage)}`}>
                    {usageStats.apiUsage.used} / {usageStats.apiUsage.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usageStats.apiUsage.percentage}%` }}
                    transition={{ duration: 1, delay: 0.4 }}
                    className={`h-2 rounded-full ${getUsageBarColor(usageStats.apiUsage.percentage)}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Savings & Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Impact
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <CurrencyEuroIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  €{usageStats.savings.totalSavings.toFixed(0)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Total Savings
                </p>
              </div>

              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  €{usageStats.savings.averageSavingsPerProduct}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Avg per Product
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Service Uptime</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {usageStats.performance.uptime}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Avg Response Time</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {usageStats.performance.averageResponseTime}ms
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upgrade Section */}
      {currentPlan === 'free' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800"
        >
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Ready to unlock more savings?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Upgrade to Pro or Enterprise for advanced features and unlimited tracking
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pro Plan */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800"
            >
              <div className="text-center mb-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pro Plan
                </h4>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  €{formatPrice(SUBSCRIPTION_PLANS.pro.amountMonthly)}
                  <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                </p>
              </div>
              
              <ul className="space-y-2 mb-6">
                {SUBSCRIPTION_PLANS.pro.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUpgrade('pro')}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Upgrade to Pro
              </motion.button>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-purple-200 dark:border-purple-800"
            >
              <div className="text-center mb-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Enterprise Plan
                </h4>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  €{formatPrice(SUBSCRIPTION_PLANS.enterprise.amountMonthly)}
                  <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                </p>
              </div>
              
              <ul className="space-y-2 mb-6">
                {SUBSCRIPTION_PLANS.enterprise.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUpgrade('enterprise')}
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Upgrade to Enterprise
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Feature Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Current Plan Features
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planDetails.features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
} 