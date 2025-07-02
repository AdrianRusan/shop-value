/**
 * Analytics Provider Component
 * Handles initialization and user tracking for analytics systems
 */

'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import analytics, { trackUserAction } from '@/lib/analytics';

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { user, isSignedIn } = useUser();

  // Initialize user tracking when user signs in
  useEffect(() => {
    if (isSignedIn && user) {
      // Set user properties for analytics
      analytics.setUser(user.id, {
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        signupDate: user.createdAt?.toISOString(),
        // Note: subscription data will be set separately when available
      });

      // Track login event
      trackUserAction('user_login', user.id, {
        loginMethod: 'clerk',
      });
    } else if (!isSignedIn) {
      // Reset analytics when user signs out
      analytics.reset();
    }
  }, [isSignedIn, user]);

  // Track page visibility changes for session management
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Flush pending analytics events when page becomes hidden
        analytics.flush();
      }
    };

    // Track page unload to flush analytics
    const handleBeforeUnload = () => {
      analytics.flush();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return <>{children}</>;
}