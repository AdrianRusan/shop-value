'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

interface TrackingState {
  isTracked: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseTrackingProps {
  productId: string;
  initialTracked?: boolean;
}

interface TrackingAPI {
  trackProduct: (productId: string, userId: string) => Promise<void>;
  untrackProduct: (productId: string, userId: string) => Promise<void>;
  getTrackingStatus: (productId: string, userId: string) => Promise<boolean>;
}

// API functions for tracking operations
const trackingAPI: TrackingAPI = {
  trackProduct: async (productId: string, userId: string) => {
    const response = await fetch('/api/products/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to track product');
    }
  },

  untrackProduct: async (productId: string, userId: string) => {
    const response = await fetch('/api/products/untrack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to untrack product');
    }
  },

  getTrackingStatus: async (productId: string, userId: string) => {
    const response = await fetch(`/api/products/tracking-status?productId=${productId}&userId=${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get tracking status');
    }

    const data = await response.json();
    return data.isTracked;
  },
};

export const useTracking = ({ productId, initialTracked = false }: UseTrackingProps) => {
  const { user, isSignedIn } = useUser();
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isTracked: initialTracked,
    isLoading: false,
    error: null,
  });

  // Fetch tracking status when component mounts or user changes
  useEffect(() => {
    if (isSignedIn && user?.id) {
      fetchTrackingStatus();
    }
  }, [isSignedIn, user?.id, productId]);

  const fetchTrackingStatus = useCallback(async () => {
    if (!isSignedIn || !user?.id) return;

    setTrackingState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const isTracked = await trackingAPI.getTrackingStatus(productId, user.id);
      setTrackingState(prev => ({ ...prev, isTracked, isLoading: false }));
    } catch (error) {
      console.error('Error fetching tracking status:', error);
      setTrackingState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to check tracking status' 
      }));
    }
  }, [productId, user?.id, isSignedIn]);

  const toggleTracking = useCallback(async () => {
    if (!isSignedIn || !user?.id) {
      throw new Error('User must be signed in to track products');
    }

    const previousState = trackingState.isTracked;
    
    // Optimistic update
    setTrackingState(prev => ({ 
      ...prev, 
      isTracked: !prev.isTracked, 
      isLoading: true,
      error: null 
    }));

    try {
      if (previousState) {
        await trackingAPI.untrackProduct(productId, user.id);
      } else {
        await trackingAPI.trackProduct(productId, user.id);
      }
      
      setTrackingState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Error toggling tracking:', error);
      
      // Revert optimistic update on error
      setTrackingState(prev => ({ 
        ...prev, 
        isTracked: previousState,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update tracking status'
      }));
      
      throw error;
    }
  }, [productId, user?.id, isSignedIn, trackingState.isTracked]);

  const trackProduct = useCallback(async () => {
    if (!isSignedIn || !user?.id) {
      throw new Error('User must be signed in to track products');
    }

    if (trackingState.isTracked) {
      return; // Already tracked
    }

    setTrackingState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await trackingAPI.trackProduct(productId, user.id);
      setTrackingState(prev => ({ ...prev, isTracked: true, isLoading: false }));
    } catch (error) {
      console.error('Error tracking product:', error);
      setTrackingState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to track product'
      }));
      throw error;
    }
  }, [productId, user?.id, isSignedIn, trackingState.isTracked]);

  const untrackProduct = useCallback(async () => {
    if (!isSignedIn || !user?.id) {
      throw new Error('User must be signed in to untrack products');
    }

    if (!trackingState.isTracked) {
      return; // Already untracked
    }

    setTrackingState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await trackingAPI.untrackProduct(productId, user.id);
      setTrackingState(prev => ({ ...prev, isTracked: false, isLoading: false }));
    } catch (error) {
      console.error('Error untracking product:', error);
      setTrackingState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to untrack product'
      }));
      throw error;
    }
  }, [productId, user?.id, isSignedIn, trackingState.isTracked]);

  const clearError = useCallback(() => {
    setTrackingState(prev => ({ ...prev, error: null }));
  }, []);

  const refresh = useCallback(() => {
    fetchTrackingStatus();
  }, [fetchTrackingStatus]);

  return {
    // State
    isTracked: trackingState.isTracked,
    isLoading: trackingState.isLoading,
    error: trackingState.error,
    
    // Actions
    toggleTracking,
    trackProduct,
    untrackProduct,
    clearError,
    refresh,
    
    // Utility
    canTrack: isSignedIn && !!user?.id,
  };
};

export default useTracking;