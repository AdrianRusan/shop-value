'use client'

import React, { useState } from 'react';
import { TrackedProductsGrid } from './TrackedProductsGrid';
import { WishlistManager } from './WishlistManager';

interface DashboardContentProps {
  clerkUser: any;
  mongoUser: any;
}

export function DashboardContent({ clerkUser, mongoUser }: DashboardContentProps) {
  const [activeTab, setActiveTab] = useState<'tracked' | 'wishlist'>('tracked');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bună ziua, {clerkUser.firstName || 'Utilizator'}! 👋
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Gestionează produsele urmărite și wishlist-ul tău
          </p>
        </div>

        {/* User Info Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Clerk User Info */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Informații Cont
              </h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Email:</span> {clerkUser.emailAddresses[0]?.emailAddress}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Nume:</span> {clerkUser.firstName} {clerkUser.lastName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Verificat:</span> {
                    clerkUser.emailAddresses[0]?.verification?.status === 'verified' 
                      ? '✅ Da' 
                      : '❌ Nu'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Info */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Abonament
              </h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Plan:</span> {
                    mongoUser?.subscription?.plan ? 
                    mongoUser.subscription.plan.toUpperCase() : 
                    'FREE'
                  }
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Status:</span> {
                    mongoUser?.subscription?.status ? 
                    mongoUser.subscription.status.toUpperCase() : 
                    'ACTIVE'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Utilizare
              </h3>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Produse urmărite:</span> {
                    mongoUser?.usage?.productsTracked || 0
                  } / {
                    mongoUser?.usage?.maxProducts || 5
                  }
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Email-uri trimise:</span> {
                    mongoUser?.usage?.emailsSent || 0
                  } / {
                    mongoUser?.usage?.maxEmails || 10
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('tracked')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'tracked'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Produse Urmărite
                </div>
              </button>
              <button
                onClick={() => setActiveTab('wishlist')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'wishlist'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Wishlist
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {activeTab === 'tracked' ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Produsele Tale Urmărite
                </h2>
                <a
                  href="/produse"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adaugă Produs Nou
                </a>
              </div>
              
              <TrackedProductsGrid />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Wishlist-ul Tău
                </h2>
                <a
                  href="/produse"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Explorează Produse
                </a>
              </div>
              
              <WishlistManager />
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Acțiuni Rapide
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/produse"
              className="block rounded-lg bg-primary px-4 py-3 text-center text-white shadow hover:bg-primary/90 transition-colors"
            >
              Explorează Produse
            </a>
            <button
              onClick={() => setActiveTab('tracked')}
              className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-white shadow hover:bg-blue-700 transition-colors"
            >
              Vezi Urmărire
            </button>
            <button
              onClick={() => setActiveTab('wishlist')}
              className="block rounded-lg bg-pink-600 px-4 py-3 text-center text-white shadow hover:bg-pink-700 transition-colors"
            >
              Gestionează Wishlist
            </button>
            <a
              href="/customer-portal"
              className="block rounded-lg bg-green-600 px-4 py-3 text-center text-white shadow hover:bg-green-700 transition-colors"
            >
              Gestionează Abonament
            </a>
          </div>
        </div>

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Debug Info (Development)
            </h2>
            <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-4">
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                {JSON.stringify({
                  activeTab,
                  mongoUserExists: !!mongoUser,
                  mongoUserId: mongoUser?._id,
                  lastLogin: mongoUser?.lastLoginAt,
                  loginCount: mongoUser?.loginCount
                }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}