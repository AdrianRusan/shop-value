'use client'

import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

interface PriceHistoryChartProps {
  productId: string;
  onClose: () => void;
}

interface PriceHistoryData {
  date: Date;
  price: number;
}

export function PriceHistoryChart({ productId, onClose }: PriceHistoryChartProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<any>(null);

  // Fetch price history data
  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch product details to get price history
        const response = await fetch(`/api/products/${productId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch product data');
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to fetch product data');
        }

        const product = data.data;
        setProductInfo(product);

        // Process price history data
        const historyData = product.priceHistory?.map((item: any) => ({
          date: new Date(item.date),
          price: item.price
        })) || [];

        // Add current price as latest point
        if (historyData.length === 0 || historyData[historyData.length - 1].price !== product.currentPrice) {
          historyData.push({
            date: new Date(),
            price: product.currentPrice
          });
        }

        setPriceHistory(historyData);
      } catch (error) {
        console.error('Error fetching price history:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchPriceHistory();
    }
  }, [productId]);

  // Create chart
  useEffect(() => {
    if (chartRef.current && priceHistory.length > 0 && !loading) {
      // Destroy existing chart
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      // Prepare data - convert dates to timestamps for Chart.js
      const chartData = priceHistory.map(item => ({
        x: item.date.getTime(),
        y: item.price
      }));

      // Calculate price range for better visualization
      const prices = priceHistory.map((item: PriceHistoryData) => item.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      const padding = priceRange * 0.1; // 10% padding

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Preț de-a lungul timpului',
              data: chartData,
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#3B82F6',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `Istoricul prețurilor - ${productInfo?.title || 'Produs'}`,
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              borderColor: '#3B82F6',
              borderWidth: 1,
              callbacks: {
                label: function(context: any) {
                  return `Preț: ${context.parsed.y} ${productInfo?.currency || 'RON'}`;
                },
                title: function(context: any[]) {
                  const date = new Date(context[0].parsed.x);
                  return date.toLocaleDateString('ro-RO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'dd MMM'
                }
              },
              title: {
                display: true,
                text: 'Data'
              },
              grid: {
                color: 'rgba(156, 163, 175, 0.3)'
              }
            },
            y: {
              min: Math.max(0, minPrice - padding),
              max: maxPrice + padding,
              title: {
                display: true,
                text: `Preț (${productInfo?.currency || 'RON'})`
              },
              grid: {
                color: 'rgba(156, 163, 175, 0.3)'
              },
              ticks: {
                callback: function(value: any) {
                  return `${value} ${productInfo?.currency || 'RON'}`;
                }
              }
            },
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        },
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [priceHistory, loading, productInfo]);

  // Price statistics
  const getPriceStats = () => {
    if (priceHistory.length === 0) return null;

    const prices = priceHistory.map((item: PriceHistoryData) => item.price);
    const currentPrice = prices[prices.length - 1];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.length > 0 
      ? prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length 
      : 0;
    const firstPrice = prices[0];
    const priceChange = currentPrice - firstPrice;
    const priceChangePercentage = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

    return {
      current: currentPrice,
      min: minPrice,
      max: maxPrice,
      average: avgPrice,
      change: priceChange,
      changePercentage: priceChangePercentage
    };
  };

  const stats = getPriceStats();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Istoricul prețurilor
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
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Se încarcă istoricul...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 dark:text-red-400">
                <p className="text-lg font-semibold">Eroare la încărcarea istoricului</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : priceHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">
                Nu există date de istoric pentru acest produs.
              </div>
            </div>
          ) : (
            <>
              {/* Price Statistics */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț curent</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stats.current} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț minim</div>
                    <div className="text-lg font-semibold text-green-600">
                      {stats.min} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț maxim</div>
                    <div className="text-lg font-semibold text-red-600">
                      {stats.max} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț mediu</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {Math.round(stats.average)} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Schimbare</div>
                    <div className={`text-lg font-semibold ${
                      stats.changePercentage > 0 ? 'text-red-600' : 
                      stats.changePercentage < 0 ? 'text-green-600' : 
                      'text-gray-900 dark:text-white'
                    }`}>
                      {stats.changePercentage > 0 ? '+' : ''}{stats.changePercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4" style={{ height: '400px' }}>
                <canvas ref={chartRef} />
              </div>

              {/* Additional Info */}
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Ultima actualizare: {priceHistory.length > 0 ? 
                    new Date(priceHistory[priceHistory.length - 1].date).toLocaleString('ro-RO') : 
                    'N/A'
                  }
                </p>
                <p>Numărul de puncte de date: {priceHistory.length}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}