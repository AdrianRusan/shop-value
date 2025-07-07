'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

interface QuickActionsPanelProps {
  selectedProducts: Set<string>;
  onBulkAction: (action: string, productIds: string[]) => Promise<void>;
  onFilterChange: (filters: any) => void;
  onRefresh: () => void;
  activeTab: 'tracked' | 'wishlist';
  filters: {
    category: string;
    status: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search: string;
  };
}

export function QuickActionsPanel({
  selectedProducts,
  onBulkAction,
  onFilterChange,
  onRefresh,
  activeTab,
  filters
}: QuickActionsPanelProps) {
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [quickFilters, setQuickFilters] = useState({
    priceDropped: false,
    inStock: false,
    outOfStock: false,
    highPriority: false
  });

  // Keyboard shortcuts handler
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    const key = event.key.toLowerCase();
    
    // Check for modifier keys
    const hasCtrl = event.ctrlKey || event.metaKey;
    const hasShift = event.shiftKey;
    const hasAlt = event.altKey;

    // Prevent default browser shortcuts we're overriding
    if (hasCtrl && ['r', 'f', 'a', 'd'].includes(key)) {
      event.preventDefault();
    }

    // Keyboard shortcuts
    switch (true) {
      // Ctrl/Cmd + R: Refresh
      case hasCtrl && key === 'r':
        onRefresh();
        break;
        
      // Ctrl/Cmd + F: Focus search
      case hasCtrl && key === 'f':
        searchInputRef.current?.focus();
        break;
        
      // Ctrl/Cmd + A: Select all visible products
      case hasCtrl && key === 'a':
        // This will be handled by parent component
        break;
        
      // Ctrl/Cmd + D: Bulk delete selected
      case hasCtrl && key === 'd' && selectedProducts.size > 0:
        setShowBulkActionsModal(true);
        break;
        
      // Alt + N: Add new product/Navigate to products
      case hasAlt && key === 'n':
        window.location.href = '/produse';
        break;
        
      // Esc: Clear selection and close modals
      case key === 'escape':
        setShowBulkActionsModal(false);
        setShowKeyboardShortcuts(false);
        // Clear selection handled by parent
        break;
        
      // 1-4: Quick filter toggles
      case ['1', '2', '3', '4'].includes(key) && hasAlt:
        const filterMap = {
          '1': 'priceDropped',
          '2': 'inStock', 
          '3': 'outOfStock',
          '4': 'highPriority'
        };
        const filterKey = filterMap[key as '1'|'2'|'3'|'4'];
        if (filterKey) {
          setQuickFilters(prev => ({
            ...prev,
            [filterKey]: !prev[filterKey as keyof typeof prev]
          }));
        }
        break;
        
      // H: Show keyboard shortcuts help
      case key === 'h' && hasCtrl:
        setShowKeyboardShortcuts(!showKeyboardShortcuts);
        break;
    }
  }, [selectedProducts, onRefresh, showKeyboardShortcuts]);

  // Setup keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Apply quick filters when they change
  useEffect(() => {
    const newFilters = { ...filters };
    
    // Apply quick filter logic
    if (quickFilters.priceDropped) {
      newFilters.sortBy = 'priceChange';
      newFilters.sortOrder = 'asc';
    }
    if (quickFilters.inStock || quickFilters.outOfStock) {
      newFilters.status = quickFilters.inStock ? 'inStock' : 'outOfStock';
    }
    
    onFilterChange(newFilters);
  }, [quickFilters, onFilterChange]);

  // Bulk action handlers
  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsProcessing(true);
    try {
      await onBulkAction('delete', Array.from(selectedProducts));
      setShowBulkActionsModal(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPriceAlert = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsProcessing(true);
    try {
      await onBulkAction('priceAlert', Array.from(selectedProducts));
    } catch (error) {
      console.error('Bulk price alert setup failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkWishlistAdd = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsProcessing(true);
    try {
      await onBulkAction('addToWishlist', Array.from(selectedProducts));
    } catch (error) {
      console.error('Bulk wishlist add failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkTrackingToggle = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsProcessing(true);
    try {
      const action = activeTab === 'wishlist' ? 'startTracking' : 'stopTracking';
      await onBulkAction(action, Array.from(selectedProducts));
    } catch (error) {
      console.error('Bulk tracking toggle failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Quick Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Side - Bulk Actions */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Acțiuni rapide:
            </span>
            
            {selectedProducts.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary text-white px-2 py-1 rounded-full">
                  {selectedProducts.size} selectate
                </span>
                
                <button
                  onClick={() => setShowBulkActionsModal(true)}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                  disabled={isProcessing}
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Șterge
                </button>
                
                <button
                  onClick={handleBulkPriceAlert}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                  disabled={isProcessing}
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 17h3m-3 0V7a4 4 0 014-4h1a4 4 0 014 4v10" />
                  </svg>
                  Alertă preț
                </button>
                
                {activeTab === 'tracked' ? (
                  <button
                    onClick={handleBulkWishlistAdd}
                    className="px-3 py-1.5 bg-pink-600 text-white text-sm rounded-md hover:bg-pink-700 transition-colors"
                    disabled={isProcessing}
                  >
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    La wishlist
                  </button>
                ) : (
                  <button
                    onClick={handleBulkTrackingToggle}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    disabled={isProcessing}
                  >
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Urmărește
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Side - Search and Actions */}
          <div className="flex items-center gap-2">
            {/* Quick Search */}
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Caută produse... (Ctrl+F)"
                value={filters.search}
                onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
                className="pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64"
              />
              <svg className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Actualizează (Ctrl+R)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Keyboard Shortcuts Help */}
            <button
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Scurtături tastatură (Ctrl+H)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
              Filtre rapide:
            </span>
            
            <button
              onClick={() => setQuickFilters(prev => ({ ...prev, priceDropped: !prev.priceDropped }))}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                quickFilters.priceDropped
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Alt+1"
            >
              📉 Preț scăzut
            </button>
            
            <button
              onClick={() => setQuickFilters(prev => ({ ...prev, inStock: !prev.inStock }))}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                quickFilters.inStock
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Alt+2"
            >
              ✅ În stoc
            </button>
            
            <button
              onClick={() => setQuickFilters(prev => ({ ...prev, outOfStock: !prev.outOfStock }))}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                quickFilters.outOfStock
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Alt+3"
            >
              ❌ Fără stoc
            </button>
            
            <button
              onClick={() => setQuickFilters(prev => ({ ...prev, highPriority: !prev.highPriority }))}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                quickFilters.highPriority
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Alt+4"
            >
              ⭐ Prioritate
            </button>

            {/* Clear all filters */}
            {Object.values(quickFilters).some(Boolean) && (
              <button
                onClick={() => setQuickFilters({ priceDropped: false, inStock: false, outOfStock: false, highPriority: false })}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Resetează filtre
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Confirmation Modal */}
      {showBulkActionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirmare acțiune în masă
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Ești sigur că vrei să ștergi {selectedProducts.size} produse selectate? 
              Această acțiune nu poate fi anulată.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? 'Se procesează...' : 'Da, șterge'}
              </button>
              <button
                onClick={() => setShowBulkActionsModal(false)}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Scurtături tastatură
              </h3>
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Navigare generală</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Actualizează</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+R</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Caută</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+F</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Produs nou</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Alt+N</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Ajutor</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+H</kbd>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Acțiuni în masă</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Selectează tot</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+A</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Șterge selectate</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+D</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Anulează</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Esc</kbd>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Filtre rapide</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Preț scăzut</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Alt+1</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>În stoc</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Alt+2</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Fără stoc</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Alt+3</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Prioritate</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">Alt+4</kbd>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Sfaturi</h4>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p>• Folosește Shift+Click pentru a selecta mai multe produse</p>
                  <p>• Scurtăturile nu funcționează în câmpurile de text</p>
                  <p>• Apasă Esc pentru a anula orice acțiune</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 