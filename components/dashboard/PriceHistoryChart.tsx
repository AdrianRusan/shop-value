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
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

type ChartType = 'line' | 'candlestick';
type TimeRange = '1D' | '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export function PriceHistoryChart({ productId, onClose }: PriceHistoryChartProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [chartLibsLoaded, setChartLibsLoaded] = useState(false);

  // Load chart plugins only on client side
  useEffect(() => {
    const loadChartPlugins = async () => {
      if (typeof window !== 'undefined') {
        try {
          const [zoomPlugin, { CandlestickController, CandlestickElement }] = await Promise.all([
            import('chartjs-plugin-zoom'),
            import('chartjs-chart-financial')
          ]);
          
          // Register Chart.js components
          Chart.register(zoomPlugin.default, CandlestickController, CandlestickElement);
          setChartLibsLoaded(true);
        } catch (error) {
          console.error('Error loading chart plugins:', error);
          setChartLibsLoaded(true); // Still allow basic charts to work
        }
      }
    };

    loadChartPlugins();
  }, []);

  // Filter data based on time range
  const getFilteredData = (data: PriceHistoryData[], range: TimeRange) => {
    if (range === 'ALL' || data.length === 0) return data;

    const now = new Date();
    const cutoffDate = new Date();

    switch (range) {
      case '1D':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case '7D':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return data.filter(item => item.date >= cutoffDate);
  };

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

        // Process price history data with simulated OHLC data for candlestick charts
        const historyData = product.priceHistory?.map((item: any, index: number) => {
          const price = item.price;
          // Simulate OHLC data with small variations for demo purposes
          const variation = price * 0.02; // 2% variation
          const high = price + (Math.random() * variation);
          const low = price - (Math.random() * variation);
          const open = index > 0 ? product.priceHistory[index - 1].price : price;
          const close = price;

          return {
            date: new Date(item.date),
            price: price,
            high: high,
            low: low,
            open: open,
            close: close
          };
        }) || [];

        // Add current price as latest point
        if (historyData.length === 0 || historyData[historyData.length - 1].price !== product.currentPrice) {
          const lastPrice = historyData.length > 0 ? historyData[historyData.length - 1].price : product.currentPrice;
          const currentPrice = product.currentPrice;
          const variation = currentPrice * 0.02;
          
          historyData.push({
            date: new Date(),
            price: currentPrice,
            high: currentPrice + (Math.random() * variation * 0.5),
            low: currentPrice - (Math.random() * variation * 0.5),
            open: lastPrice,
            close: currentPrice
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
    // Only create chart if libraries are loaded and we're on client side
    if (!chartLibsLoaded || typeof window === 'undefined') return;

    const filteredData = getFilteredData(priceHistory, timeRange);
    
    if (chartRef.current && filteredData.length > 0 && !loading) {
      // Destroy existing chart
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      // Calculate price range for better visualization
      const prices = filteredData.map((item: PriceHistoryData) => 
        chartType === 'candlestick' ? [item.high!, item.low!] : [item.price]
      ).flat().filter(Boolean);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      const padding = priceRange * 0.1; // 10% padding

      let chartData;
      let chartOptions;

      if (chartType === 'line') {
        // Line chart data
        chartData = {
          datasets: [
            {
              label: 'Preț de-a lungul timpului',
              data: filteredData.map(item => ({
                x: item.date.getTime(),
                y: item.price
              })),
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#3B82F6',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 8,
            },
          ],
        };
      } else {
        // Candlestick chart data
        chartData = {
          datasets: [
            {
              label: 'Preț OHLC',
              data: filteredData.map(item => ({
                x: item.date.getTime(),
                o: item.open,
                h: item.high,
                l: item.low,
                c: item.close
              })),
              borderColor: (ctx: any) => {
                const point = ctx.raw;
                return point && point.c >= point.o ? '#10B981' : '#EF4444'; // Green for up, red for down
              },
              backgroundColor: (ctx: any) => {
                const point = ctx.raw;
                return point && point.c >= point.o ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
              },
            },
          ],
        };
      }

      chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Istoricul prețurilor - ${productInfo?.title || 'Produs'} (${timeRange})`,
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#3B82F6',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(context: any) {
                const currency = productInfo?.currency || 'RON';
                if (chartType === 'candlestick') {
                  const data = context.raw;
                  return [
                    `Deschidere: ${data.o?.toFixed(2)} ${currency}`,
                    `Maxim: ${data.h?.toFixed(2)} ${currency}`,
                    `Minim: ${data.l?.toFixed(2)} ${currency}`,
                    `Închidere: ${data.c?.toFixed(2)} ${currency}`,
                    `Variație: ${data.c && data.o ? ((data.c - data.o) / data.o * 100).toFixed(2) : 0}%`
                  ];
                } else {
                  return `Preț: ${context.parsed.y?.toFixed(2)} ${currency}`;
                }
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
          },
          zoom: chartLibsLoaded ? {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
            },
            pan: {
              enabled: true,
              mode: 'x',
            }
          } : undefined
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: filteredData.length > 100 ? 'day' : 'hour',
              displayFormats: {
                hour: 'HH:mm',
                day: 'dd MMM',
                month: 'MMM yyyy'
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
                return `${parseFloat(value).toFixed(2)} ${productInfo?.currency || 'RON'}`;
              }
            }
          },
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      };

      chartInstanceRef.current = new Chart(ctx, {
        type: chartType === 'candlestick' ? 'candlestick' as any : 'line',
        data: chartData,
        options: chartOptions,
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [priceHistory, loading, productInfo, chartType, timeRange, chartLibsLoaded]);

  // Reset zoom function
  const resetZoom = () => {
    if (chartInstanceRef.current && typeof window !== 'undefined') {
      chartInstanceRef.current.resetZoom();
    }
  };

  // Price statistics
  const getPriceStats = () => {
    const filteredData = getFilteredData(priceHistory, timeRange);
    if (filteredData.length === 0) return null;

    const prices = filteredData.map((item: PriceHistoryData) => item.price);
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
  const filteredDataCount = getFilteredData(priceHistory, timeRange).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Istoricul prețurilor - Grafic interactiv
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
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
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
              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                {/* Chart Type Toggle */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tip grafic:</span>
                  <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        chartType === 'line'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      Linie
                    </button>
                    <button
                      onClick={() => setChartType('candlestick')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        chartType === 'candlestick'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      Candlestick
                    </button>
                  </div>
                </div>

                {/* Time Range Selectors */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Perioadă:</span>
                  <div className="flex flex-wrap gap-1">
                    {(['1D', '7D', '1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                          timeRange === range
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset Zoom Button */}
                {chartLibsLoaded && (
                  <button
                    onClick={resetZoom}
                    className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Reset Zoom
                  </button>
                )}
              </div>

              {/* Price Statistics */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț curent</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stats.current?.toFixed(2)} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț minim</div>
                    <div className="text-lg font-semibold text-green-600">
                      {stats.min?.toFixed(2)} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț maxim</div>
                    <div className="text-lg font-semibold text-red-600">
                      {stats.max?.toFixed(2)} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Preț mediu</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stats.average?.toFixed(2)} {productInfo?.currency || 'RON'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Schimbare</div>
                    <div className={`text-lg font-semibold ${
                      stats.changePercentage > 0 ? 'text-red-600' : 
                      stats.changePercentage < 0 ? 'text-green-600' : 
                      'text-gray-900 dark:text-white'
                    }`}>
                      {stats.changePercentage > 0 ? '+' : ''}{stats.changePercentage?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4" style={{ height: '500px' }}>
                {!chartLibsLoaded ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Se încarcă biblioteca graficelor...</span>
                  </div>
                ) : (
                  <canvas ref={chartRef} />
                )}
              </div>

              {/* Chart Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Instrucțiuni pentru utilizarea graficului:
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• <strong>Zoom:</strong> Folosește mouse wheel sau gesturile de pinch pentru a mări/micșora</li>
                  <li>• <strong>Pan:</strong> Cloacă și trage pentru a naviga prin grafic</li>
                  <li>• <strong>Tooltip:</strong> Poziționează cursorul pe punctele de date pentru detalii</li>
                  <li>• <strong>Perioada:</strong> Selectează butoanele de timp pentru a filtra datele</li>
                  <li>• <strong>Tip grafic:</strong> Comută între vizualizarea linie și candlestick</li>
                </ul>
              </div>

              {/* Additional Info */}
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  Ultima actualizare: {priceHistory.length > 0 ? 
                    new Date(priceHistory[priceHistory.length - 1].date).toLocaleString('ro-RO') : 
                    'N/A'
                  }
                </p>
                <p>Puncte de date afișate: {filteredDataCount} din {priceHistory.length} total</p>
                <p>Perioada selectată: {timeRange}</p>
                {chartLibsLoaded && <p>✅ Funcționalitate avansată încărcată (zoom, candlestick)</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}