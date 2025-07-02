/**
 * Monitoring Setup Component
 * Initializes performance monitoring and provides debug information
 */

'use client';

import { useEffect, useState } from 'react';
import performanceMonitor from '@/lib/performance';
import analytics from '@/lib/analytics';

interface MonitoringStatus {
  amplitude: boolean;
  sentry: boolean;
  performance: boolean;
  webVitals: boolean;
}

export default function MonitoringSetup() {
  const [status, setStatus] = useState<MonitoringStatus>({
    amplitude: false,
    sentry: false,
    performance: false,
    webVitals: false,
  });

  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // Initialize performance monitoring
    try {
      performanceMonitor.trackWebVitals();
      setStatus(prev => ({ ...prev, performance: true, webVitals: true }));
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    }

    // Check Amplitude status
    const amplitudeApiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    setStatus(prev => ({ ...prev, amplitude: !!amplitudeApiKey }));

    // Check Sentry status
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    setStatus(prev => ({ ...prev, sentry: !!sentryDsn }));

    // Track monitoring initialization
    analytics.track('monitoring_initialized', {
      amplitude: !!amplitudeApiKey,
      sentry: !!sentryDsn,
      performance: true,
      webVitals: true,
    });

    if (isDevelopment) {
      console.log('Monitoring Status:', {
        amplitude: !!amplitudeApiKey,
        sentry: !!sentryDsn,
        performance: true,
        webVitals: true,
      });
    }
  }, [isDevelopment]);

  // Only show debug information in development
  if (!isDevelopment) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <details className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-xs">
        <summary className="cursor-pointer font-medium">
          Monitoring Status
        </summary>
        <div className="mt-2 space-y-1">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status.amplitude ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span>Amplitude Analytics</span>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status.sentry ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span>Sentry Error Tracking</span>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status.performance ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span>Performance Monitoring</span>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status.webVitals ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span>Web Vitals Tracking</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => {
                // Test error tracking
                throw new Error('Test error for monitoring');
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Test Error Tracking
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}