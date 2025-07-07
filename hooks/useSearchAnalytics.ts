import { useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

interface UseSearchAnalyticsReturn {
  trackSearch: (query: string, filters: any, results: { count: number; responseTime: number }) => void;
  trackResultClick: (query: string, productId: string, position: number, filters?: any) => void;
  trackConversion: (query: string, productId: string, conversionType: 'track' | 'alert' | 'share') => void;
  trackPerformance: (query: string, responseTime: number, resultCount: number, errorOccurred?: boolean) => void;
}

export function useSearchAnalytics(): UseSearchAnalyticsReturn {
  const { user } = useUser();
  const sessionIdRef = useRef<string>();

  // Generate or get session ID
  if (!sessionIdRef.current) {
    sessionIdRef.current = typeof window !== 'undefined' 
      ? `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      : 'server_session';
  }

  const sendAnalytics = useCallback(async (action: string, data: any) => {
    try {
      await fetch('/api/search/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          data: {
            ...data,
            user: {
              sessionId: sessionIdRef.current,
              id: user?.id,
            }
          }
        }),
      });
    } catch (error) {
      console.error('Failed to send search analytics:', error);
      // Don't throw to avoid breaking user experience
    }
  }, [user?.id]);

  const trackSearch = useCallback((
    query: string, 
    filters: any, 
    results: { count: number; responseTime: number }
  ) => {
    sendAnalytics('track_search', {
      query,
      filters,
      results: {
        count: results.count,
        responseTime: results.responseTime,
        products: [] // Could be populated with actual product IDs if needed
      }
    });
  }, [sendAnalytics]);

  const trackResultClick = useCallback((
    query: string, 
    productId: string, 
    position: number, 
    filters?: any
  ) => {
    sendAnalytics('track_click', {
      query,
      productId,
      position,
      sessionId: sessionIdRef.current,
      filters
    });
  }, [sendAnalytics]);

  const trackConversion = useCallback((
    query: string, 
    productId: string, 
    conversionType: 'track' | 'alert' | 'share'
  ) => {
    sendAnalytics('track_conversion', {
      query,
      productId,
      sessionId: sessionIdRef.current,
      conversionType
    });
  }, [sendAnalytics]);

  const trackPerformance = useCallback((
    query: string, 
    responseTime: number, 
    resultCount: number, 
    errorOccurred: boolean = false
  ) => {
    sendAnalytics('track_performance', {
      query,
      responseTime,
      resultCount,
      cacheHit: false, // Could be determined if cache headers are available
      errorOccurred,
      errorMessage: errorOccurred ? 'Search failed' : undefined
    });
  }, [sendAnalytics]);

  return {
    trackSearch,
    trackResultClick,
    trackConversion,
    trackPerformance
  };
}