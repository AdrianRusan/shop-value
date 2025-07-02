'use client'

import React, { useState, useEffect } from 'react';

interface AlertSettings {
  priceDecrease: boolean;
  priceIncrease: boolean;
  backInStock: boolean;
  threshold?: number;
  frequency: 'immediate' | 'daily' | 'weekly';
}

interface AlertConfigModalProps {
  trackingId: string;
  onClose: () => void;
  onSave: (trackingId: string, alertSettings: AlertSettings) => void;
}

export function AlertConfigModal({ trackingId, onClose, onSave }: AlertConfigModalProps) {
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    priceDecrease: true,
    priceIncrease: false,
    backInStock: true,
    threshold: undefined,
    frequency: 'immediate'
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<any>(null);

  // Fetch current alert settings
  useEffect(() => {
    const fetchAlertSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        // In a real implementation, you'd fetch the tracking details
        // For now, we'll use default settings
        // const response = await fetch(`/api/tracking/${trackingId}`);
        
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock product info and current settings
        setProductInfo({
          title: 'Produs Demo',
          currentPrice: 1299,
          currency: 'RON'
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching alert settings:', error);
        setError('Eroare la încărcarea setărilor de alertă');
        setLoading(false);
      }
    };

    if (trackingId) {
      fetchAlertSettings();
    }
  }, [trackingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(trackingId, alertSettings);
  };

  const handleInputChange = (field: keyof AlertSettings, value: any) => {
    setAlertSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Se încarcă...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Configurează Alertele
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
              <div className="text-red-800 dark:text-red-200 text-sm">
                {error}
              </div>
            </div>
          )}

          {/* Product Info */}
          {productInfo && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Produs</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{productInfo.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Preț curent: {productInfo.currentPrice} {productInfo.currency}
              </p>
            </div>
          )}

          {/* Alert Types */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Tipuri de alertă</h3>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={alertSettings.priceDecrease}
                  onChange={(e) => handleInputChange('priceDecrease', e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Scăderea prețului 📉
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={alertSettings.priceIncrease}
                  onChange={(e) => handleInputChange('priceIncrease', e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Creșterea prețului 📈
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={alertSettings.backInStock}
                  onChange={(e) => handleInputChange('backInStock', e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Produsul revine în stoc 📦
                </span>
              </label>
            </div>
          </div>

          {/* Price Threshold */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prag de preț (opțional)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={alertSettings.threshold || ''}
                onChange={(e) => handleInputChange('threshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder={`ex: ${productInfo?.currentPrice * 0.9 || 1000}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">
                  {productInfo?.currency || 'RON'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Vei primi alertă când prețul ajunge la această valoare sau mai jos
            </p>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Frecvența alertelor
            </label>
            <select
              value={alertSettings.frequency}
              onChange={(e) => handleInputChange('frequency', e.target.value as 'immediate' | 'daily' | 'weekly')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="immediate">Imediat</option>
              <option value="daily">O dată pe zi</option>
              <option value="weekly">O dată pe săptămână</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
            >
              Salvează alertele
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}