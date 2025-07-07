'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { PriceHistoryChart } from './PriceHistoryChart';
import { AlertConfigModal } from './AlertConfigModal';
import { ProductFilters } from './ProductFilters';
import { Pagination } from './Pagination';
import { ExportModal } from './ExportModal';
import { QuickActionsPanel } from './QuickActionsPanel';
import FormatPrices from '@/components/FormatPrices';

// Utility function to format relative time
function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffInMs = now.getTime() - then.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'Acum';
  if (diffInMinutes < 60) return `Acum ${diffInMinutes} min`;
  if (diffInHours < 24) return `Acum ${diffInHours}h`;
  if (diffInDays < 7) return `Acum ${diffInDays} zi${diffInDays > 1 ? 'le' : ''}`;
  
  return then.toLocaleDateString('ro-RO', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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
    image: string;
    isOutOfStock: boolean;
    url: string;
    priceHistory: Array<{
      price: number;
      date: Date;
    }>;
    lastScrapedAt: Date;
    updatedAt: Date;
  };
  addedAt: Date;
  updatedAt: Date;
  isActive: boolean;
  alertSettings: {
    priceDecrease: boolean;
    priceIncrease: boolean;
    backInStock: boolean;
    threshold?: number;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  userNotes?: string;
  personalRating?: number;
  trackingReason: string;
  priceChangePercentage: number;
}

interface TrackedProductsResponse {
  products: TrackedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: {
    totalTracked: number;
    activeTracked: number;
    averagePriceChange: number;
  };
}

interface FilterState {
  category: string;
  status: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search: string;
}

export function TrackedProductsGrid() {
  const { user } = useUser();
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });
  const [summary, setSummary] = useState({
    totalTracked: 0,
    activeTracked: 0,
    averagePriceChange: 0
  });

  // Filter and search state
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    status: 'active',
    sortBy: 'addedAt',
    sortOrder: 'desc',
    search: ''
  });

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<TrackedProduct | null>(null);
  const [showPriceChart, setShowPriceChart] = useState<string | null>(null);
  const [showAlertConfig, setShowAlertConfig] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // View mode state (matching user preferences)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Selection state for bulk actions
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Fetch tracked products with memoized parameters
  const fetchProducts = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        category: filters.category,
        status: filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      const response = await fetch(`/api/products/user/${user.id}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const data: { success: boolean; data: TrackedProductsResponse } = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch products');
      }

      setProducts(data.data.products);
      setPagination(data.data.pagination);
      setSummary(data.data.summary);
    } catch (error) {
      console.error('Error fetching tracked products:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.id, pagination.page, pagination.limit, filters]);

  // Effect to fetch products when dependencies change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filter products locally by search term
  const filteredProducts = useMemo(() => {
    if (!filters.search.trim()) return products;
    
    const searchTerm = filters.search.toLowerCase();
    return products.filter(product => 
      product.productId.title.toLowerCase().includes(searchTerm) ||
      product.productId.brand.toLowerCase().includes(searchTerm) ||
      product.productId.category.toLowerCase().includes(searchTerm)
    );
  }, [products, filters.search]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    // Reset to first page when filters change
    if ('category' in newFilters || 'status' in newFilters) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, []);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  // Handle removing product from tracking
  const handleRemoveProduct = useCallback(async (productId: string) => {
    if (!user?.id || !confirm('Sigur vrei să elimini acest produs din urmărire?')) return;

    try {
      const response = await fetch(`/api/products/user/${user.id}?productIds=${productId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to remove product');
      }

      // Refresh products list
      await fetchProducts();
    } catch (error) {
      console.error('Error removing product:', error);
      alert('Eroare la eliminarea produsului. Te rog încearcă din nou.');
    }
  }, [user?.id, fetchProducts]);

  // Handle updating alert settings
  const handleUpdateAlerts = useCallback(async (productId: string, alertSettings: any) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/products/user/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: [productId],
          updates: { alertSettings }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update alerts');
      }

      // Refresh products list
      await fetchProducts();
      setShowAlertConfig(null);
    } catch (error) {
      console.error('Error updating alerts:', error);
      alert('Eroare la actualizarea alertelor. Te rog încearcă din nou.');
    }
  }, [user?.id, fetchProducts]);

  // Handle bulk actions
  const handleBulkAction = useCallback(async (action: string, productIds: string[]) => {
    if (!user?.id || productIds.length === 0) return;

    try {
      switch (action) {
        case 'delete':
          const deleteResponse = await fetch(`/api/products/user/${user.id}?productIds=${productIds.join(',')}`, {
            method: 'DELETE'
          });
          if (!deleteResponse.ok) throw new Error('Failed to delete products');
          break;

        case 'priceAlert':
          const alertResponse = await fetch(`/api/products/user/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productIds: productIds,
              updates: {
                alertSettings: {
                  priceDecrease: true,
                  priceIncrease: false,
                  backInStock: true,
                  threshold: 10,
                  frequency: 'immediate'
                }
              }
            })
          });
          if (!alertResponse.ok) throw new Error('Failed to setup price alerts');
          break;

        case 'addToWishlist':
          for (const productId of productIds) {
            const wishlistResponse = await fetch(`/api/products/user/${user.id}/wishlist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId })
            });
            if (!wishlistResponse.ok) {
              console.warn(`Failed to add product ${productId} to wishlist`);
            }
          }
          break;

        default:
          console.warn('Unknown bulk action:', action);
      }

      // Clear selection and refresh
      setSelectedProducts(new Set());
      await fetchProducts();
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Eroare la executarea acțiunii în masă. Te rog încearcă din nou.');
    }
  }, [user?.id, fetchProducts]);

  // Handle product selection
  const handleProductSelect = useCallback((productId: string, selected: boolean) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allProductIds = filteredProducts.map(p => p._id);
    setSelectedProducts(new Set(allProductIds));
  }, [filteredProducts]);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedProducts(new Set());
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      const hasCtrl = event.ctrlKey || event.metaKey;
      
      if (hasCtrl && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        handleSelectAll();
      }
      
      if (event.key === 'Escape') {
        handleClearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleSelectAll, handleClearSelection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Se încarcă produsele...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <p className="text-lg font-semibold">Eroare la încărcarea produselor</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => fetchProducts()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions Panel */}
      <QuickActionsPanel
        selectedProducts={selectedProducts}
        onBulkAction={handleBulkAction}
        onFilterChange={handleFilterChange}
        onRefresh={fetchProducts}
        activeTab="tracked"
        filters={filters}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.totalTracked}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Produse urmărite
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.activeTracked}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Active
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className={`text-2xl font-bold ${
            summary.averagePriceChange > 0 
              ? 'text-red-600' 
              : summary.averagePriceChange < 0 
                ? 'text-green-600' 
                : 'text-gray-900 dark:text-white'
          }`}>
            {summary.averagePriceChange > 0 ? '+' : ''}{summary.averagePriceChange.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Schimbare medie preț
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <ProductFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        
        {/* Export Button */}
        {filteredProducts.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              title="Exportă datele în format CSV sau PDF"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Exportă
            </button>
          </div>
        )}
      </div>

      {/* Products Grid/List */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            {filters.search ? 'Nu s-au găsit produse pentru această căutare.' : 'Nu urmărești încă niciun produs.'}
          </div>
          <Link
            href="/produse"
            className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Explorează produse
          </Link>
        </div>
      ) : (
        <>
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {filteredProducts.map((item) => (
              <div key={item._id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden ${
                viewMode === 'list' ? 'flex' : ''
              } ${selectedProducts.has(item._id) ? 'ring-2 ring-primary' : ''}`}>
                {/* Product Image */}
                <div className={`${viewMode === 'list' ? 'w-48 flex-shrink-0' : 'aspect-square'} relative`}>
                  {/* Selection checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(item._id)}
                      onChange={(e) => handleProductSelect(item._id, e.target.checked)}
                      className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  
                  <Image
                    src={item.productId.image}
                    alt={item.productId.title}
                    fill
                    className="object-cover"
                    sizes={viewMode === 'list' ? '192px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
                  />
                  {item.productId.isOutOfStock && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="text-white font-semibold">Stoc epuizat</span>
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm">
                      {item.productId.title}
                    </h3>
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() => setShowPriceChart(item.productId._id)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Vezi istoricul prețurilor"
                      >
                        📊
                      </button>
                      <button
                        onClick={() => setShowAlertConfig(item._id)}
                        className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                        title="Configurează alerte"
                      >
                        🔔
                      </button>
                      <button
                        onClick={() => handleRemoveProduct(item.productId._id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Elimină din urmărire"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {item.productId.brand} • {item.productId.category}
                  </div>

                  {/* Last Updated Timestamp */}
                  <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mb-1">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Actualizat: {getRelativeTime(item.productId.lastScrapedAt || item.productId.updatedAt)}
                  </div>
                  
                  {/* Tracking Started Timestamp */}
                  <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mb-2">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Urmărit din: {getRelativeTime(item.addedAt)}
                  </div>

                  {/* Price Information */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        <FormatPrices num={item.productId.currentPrice} /> {item.productId.currency}
                      </div>
                      {item.productId.originalPrice > item.productId.currentPrice && (
                        <div className="text-sm text-gray-500 line-through">
                          <FormatPrices num={item.productId.originalPrice} /> {item.productId.currency}
                        </div>
                      )}
                    </div>
                    <div className={`text-sm font-semibold ${
                      item.priceChangePercentage > 0 
                        ? 'text-red-600' 
                        : item.priceChangePercentage < 0 
                          ? 'text-green-600' 
                          : 'text-gray-500'
                    }`}>
                      {item.priceChangePercentage > 0 ? '+' : ''}{item.priceChangePercentage.toFixed(1)}%
                    </div>
                  </div>

                  {/* Alert Settings Indicator */}
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {item.alertSettings.priceDecrease && <span>📉</span>}
                    {item.alertSettings.priceIncrease && <span>📈</span>}
                    {item.alertSettings.backInStock && <span>📦</span>}
                    {item.alertSettings.threshold && (
                      <span>💰 {item.alertSettings.threshold} {item.productId.currency}</span>
                    )}
                  </div>

                  {/* User Notes */}
                  {item.userNotes && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 italic">
                      "{item.userNotes}"
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 flex space-x-2">
                    <Link
                      href={item.productId.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors text-center"
                    >
                      Vezi produs
                    </Link>
                    <button
                      onClick={() => setShowPriceChart(item.productId._id)}
                      className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Istoric
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {/* Modals */}
      {showPriceChart && (
        <PriceHistoryChart
          productId={showPriceChart}
          onClose={() => setShowPriceChart(null)}
        />
      )}

      {showAlertConfig && (
        <AlertConfigModal
          trackingId={showAlertConfig}
          onClose={() => setShowAlertConfig(null)}
          onSave={handleUpdateAlerts}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        products={filteredProducts}
        title="Exportă Produse Urmărite"
      />
    </div>
  );
}