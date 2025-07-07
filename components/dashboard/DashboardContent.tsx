'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrackedProductsGrid } from './TrackedProductsGrid';
import { WishlistManager } from './WishlistManager';
import { EnhancedSubscriptionDashboard } from './EnhancedSubscriptionDashboard';
import { RealTimePriceNotification } from '../RealTimePriceNotification';
import { 
  EyeIcon, 
  HeartIcon, 
  CreditCardIcon,
  ChartBarIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface DashboardContentProps {
  clerkUser: any;
  mongoUser: any;
}

type TabType = 'overview' | 'tracked' | 'wishlist' | 'subscription' | 'settings';

export function DashboardContent({ clerkUser, mongoUser }: DashboardContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [subscribedProducts, setSubscribedProducts] = useState<string[]>([]);

  // Check for dark mode preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(savedTheme === 'dark' || (!savedTheme && prefersDark));
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newMode);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon, description: 'Dashboard summary' },
    { id: 'tracked', label: 'Tracked Products', icon: EyeIcon, description: 'Your price tracking' },
    { id: 'wishlist', label: 'Wishlist', icon: HeartIcon, description: 'Saved products' },
    { id: 'subscription', label: 'Subscription', icon: CreditCardIcon, description: 'Plan & billing' },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, description: 'Preferences' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Real-time Notifications - Fixed Position */}
      <RealTimePriceNotification
        userId={clerkUser.id}
        subscribedProducts={subscribedProducts}
        className="fixed top-4 right-4 z-50"
        enableSound={true}
        enableDesktopNotifications={true}
        position="top-right"
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {getGreeting()}, {clerkUser.firstName || 'User'}! 👋
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Welcome to your ShopValue dashboard
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Dark Mode Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {isDarkMode ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </motion.button>

              {/* Quick Add Product Button */}
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="/produse"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Product
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Overview */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8"
          >
            {/* Account Status */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <ChartBarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Account Status
                    </h3>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {clerkUser.emailAddresses[0]?.verification?.status === 'verified' ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Plan */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <CreditCardIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Current Plan
                    </h3>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {mongoUser?.subscription?.plan?.toUpperCase() || 'FREE'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Tracked */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <EyeIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Products Tracked
                    </h3>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {mongoUser?.usage?.productsTracked || 0} / {mongoUser?.usage?.maxProducts || 5}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications Sent */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                      <BellIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Notifications
                    </h3>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {mongoUser?.usage?.emailsSent || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
            <nav className="flex space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  </motion.button>
                );
              })}
            </nav>
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-[500px]"
          >
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Welcome Message */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-blue-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Welcome to ShopValue! 🚀
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Start tracking product prices and never miss a deal again. Your personal shopping assistant is ready to help you save money.
                  </p>
                  <div className="flex items-center space-x-4">
                    <motion.a
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      href="/produse"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Your First Product
                    </motion.a>
                    <button
                      onClick={() => setActiveTab('subscription')}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      View Plans
                    </button>
                  </div>
                </div>

                {/* Quick Overview Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Account Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {clerkUser.emailAddresses[0]?.emailAddress}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Name:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {clerkUser.firstName} {clerkUser.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className={`font-medium ${
                          clerkUser.emailAddresses[0]?.verification?.status === 'verified'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {clerkUser.emailAddresses[0]?.verification?.status === 'verified' ? '✅ Verified' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Usage Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {mongoUser?.subscription?.plan?.toUpperCase() || 'FREE'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Products:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {mongoUser?.usage?.productsTracked || 0} / {mongoUser?.usage?.maxProducts || 5}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Notifications:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {mongoUser?.usage?.emailsSent || 0} sent
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tracked' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Tracked Products
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Monitor price changes and get alerts when prices drop
                    </p>
                  </div>
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href="/produse"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Product
                  </motion.a>
                </div>
                
                <TrackedProductsGrid />
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Your Wishlist
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Save products for later and track when they go on sale
                    </p>
                  </div>
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href="/produse"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                  >
                    <HeartIcon className="w-4 h-4 mr-2" />
                    Browse Products
                  </motion.a>
                </div>
                
                <WishlistManager />
              </div>
            )}

            {activeTab === 'subscription' && (
              <div>
                <EnhancedSubscriptionDashboard mongoUser={mongoUser} />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Settings
                </h2>
                
                <div className="space-y-6">
                  {/* Theme Settings */}
                  <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Theme Preference
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Choose your preferred theme
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleDarkMode}
                      className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {isDarkMode ? (
                        <>
                          <SunIcon className="w-4 h-4 mr-2" />
                          Switch to Light
                        </>
                      ) : (
                        <>
                          <MoonIcon className="w-4 h-4 mr-2" />
                          Switch to Dark
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Notification Settings */}
                  <div className="py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Notification Preferences
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                          Email notifications for price drops
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                          Desktop notifications
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                          Weekly summary emails
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="py-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Account Actions
                    </h3>
                    <div className="space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          Export Data
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Download your tracked products and price history
                        </div>
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full text-left px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <div className="font-medium text-red-900 dark:text-red-400">
                          Delete Account
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-500">
                          Permanently delete your account and all data
                        </div>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}