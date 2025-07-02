'use client';

import { useEffect } from 'react';
import { trackPerformance } from '@/lib/analytics';

interface PerformanceMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  fcp?: number;
}

export default function PerformanceMonitor() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const metrics: PerformanceMetrics = {};

    // Track Largest Contentful Paint (LCP)
    const observeLCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            metrics.lcp = lastEntry.startTime;
            
            // Track in analytics if available
            if (typeof trackPerformance === 'function') {
              trackPerformance('LCP', lastEntry.startTime);
            }
            
            console.log('LCP:', lastEntry.startTime);
          });
          
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (error) {
          console.warn('LCP observation failed:', error);
        }
      }
    };

    // Track First Input Delay (FID)
    const observeFID = () => {
      if ('PerformanceObserver' in window) {
        try {
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              metrics.fid = entry.processingStart - entry.startTime;
              
              if (typeof trackPerformance === 'function') {
                trackPerformance('FID', entry.processingStart - entry.startTime);
              }
              
              console.log('FID:', entry.processingStart - entry.startTime);
            });
          });
          
          fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (error) {
          console.warn('FID observation failed:', error);
        }
      }
    };

    // Track Cumulative Layout Shift (CLS)
    const observeCLS = () => {
      if ('PerformanceObserver' in window) {
        try {
          let clsValue = 0;
          let clsEntries: PerformanceEntry[] = [];

          const clsObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            
            entries.forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsEntries.push(entry);
                clsValue += entry.value;
              }
            });

            metrics.cls = clsValue;
            
            if (typeof trackPerformance === 'function') {
              trackPerformance('CLS', clsValue);
            }
            
            console.log('CLS:', clsValue);
          });
          
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (error) {
          console.warn('CLS observation failed:', error);
        }
      }
    };

    // Track Time to First Byte (TTFB)
    const observeTTFB = () => {
      if ('performance' in window && 'getEntriesByType' in performance) {
        try {
          const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
          if (navigationEntries.length > 0) {
            const ttfb = navigationEntries[0].responseStart - navigationEntries[0].requestStart;
            metrics.ttfb = ttfb;
            
            if (typeof trackPerformance === 'function') {
              trackPerformance('TTFB', ttfb);
            }
            
            console.log('TTFB:', ttfb);
          }
        } catch (error) {
          console.warn('TTFB measurement failed:', error);
        }
      }
    };

    // Track First Contentful Paint (FCP)
    const observeFCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                metrics.fcp = entry.startTime;
                
                if (typeof trackPerformance === 'function') {
                  trackPerformance('FCP', entry.startTime);
                }
                
                console.log('FCP:', entry.startTime);
              }
            });
          });
          
          fcpObserver.observe({ type: 'paint', buffered: true });
        } catch (error) {
          console.warn('FCP observation failed:', error);
        }
      }
    };

    // Initialize all observers
    observeLCP();
    observeFID();
    observeCLS();
    observeTTFB();
    observeFCP();

    // Send final metrics on page unload
    const sendMetrics = () => {
      if (typeof trackPerformance === 'function') {
        trackPerformance('Core Web Vitals', metrics);
      }
      
      // Send to analytics endpoint if available
      if (Object.keys(metrics).length > 0) {
        fetch('/api/analytics/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metrics),
          keepalive: true,
        }).catch(error => {
          console.warn('Failed to send performance metrics:', error);
        });
      }
    };

    // Send metrics when user leaves the page
    window.addEventListener('beforeunload', sendMetrics);
    
    // Send metrics on visibility change (covers mobile scenarios)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendMetrics();
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', sendMetrics);
      document.removeEventListener('visibilitychange', sendMetrics);
    };
  }, []);

  // This component doesn't render anything
  return null;
}