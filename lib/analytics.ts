/**
 * Analytics and Event Tracking Utility
 * Integrates Amplitude for user analytics with our existing MongoDB analytics system
 */

import * as Sentry from '@sentry/nextjs';

// Type definitions for analytics events
export interface UserProperties {
  userId?: string;
  email?: string;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
  totalTrackedProducts?: number;
  signupDate?: string;
  country?: string;
}

export interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

// Business metrics events
export type AnalyticsEvent = 
  // User lifecycle events
  | 'user_registered'
  | 'user_login'
  | 'user_logout'
  | 'user_profile_updated'
  // Subscription events
  | 'subscription_started'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_canceled'
  | 'subscription_renewed'
  // Product tracking events
  | 'product_added'
  | 'product_removed'
  | 'product_viewed'
  | 'price_alert_created'
  | 'price_alert_triggered'
  | 'price_alert_dismissed'
  // Engagement events
  | 'dashboard_viewed'
  | 'search_performed'
  | 'filter_applied'
  | 'product_shared'
  | 'feedback_submitted'
  // Conversion events
  | 'checkout_started'
  | 'checkout_completed'
  | 'trial_started'
  | 'trial_converted'
  // Error events
  | 'error_occurred'
  | 'api_error'
  | 'scraping_failed'
  // Performance events
  | 'api_performance'
  | 'component_performance'
  | 'function_performance'
  | 'web_vital'
  // System events
  | 'monitoring_initialized';

class AnalyticsManager {
  private isAmplitudeInitialized = false;
  private amplitudeModule: any = null;
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  
  constructor() {
    this.initializeAmplitude();
  }
  
  /**
   * Initialize Amplitude analytics (async with dynamic import)
   */
  private async initializeAmplitude(): Promise<void> {
    try {
      const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
      
      if (!apiKey) {
        console.warn('Amplitude API key not found. Analytics will be disabled.');
        return;
      }

      // Only initialize on client side
      if (typeof window === 'undefined') {
        return;
      }
      
      // Dynamic import to prevent build errors
      try {
        this.amplitudeModule = await import('@amplitude/analytics-browser');
        
        this.amplitudeModule.init(apiKey, {
          defaultTracking: {
            sessions: true,
            pageViews: true,
            formInteractions: true,
            fileDownloads: true,
          },
          autocapture: {
            attribution: true,
            pageViews: true,
            sessions: true,
            formInteractions: true,
          },
        });
        
        this.isAmplitudeInitialized = true;
        
        if (this.isDevelopment) {
          console.log('Amplitude analytics initialized');
        }
      } catch (importError) {
        console.warn('Amplitude package not available, analytics disabled:', importError);
        return;
      }
    } catch (error) {
      console.error('Failed to initialize Amplitude:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }
  
  /**
   * Set user properties for analytics tracking
   */
  async setUser(userId: string, properties: UserProperties = {}): Promise<void> {
    try {
      // Ensure Amplitude is initialized first
      if (!this.isAmplitudeInitialized && !this.amplitudeModule) {
        await this.initializeAmplitude();
      }

      if (this.isAmplitudeInitialized && this.amplitudeModule) {
        this.amplitudeModule.setUserId(userId);
        
        if (Object.keys(properties).length > 0) {
          const identify = new this.amplitudeModule.Identify();
          Object.entries(properties).forEach(([key, value]) => {
            if (value !== undefined) {
              identify.set(key, value);
            }
          });
          this.amplitudeModule.identify(identify);
        }
      }
      
      if (this.isDevelopment) {
        console.log('User identified:', { userId, properties });
      }
    } catch (error) {
      console.error('Failed to set user:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }
  
  /**
   * Track a business event
   */
  async track(event: AnalyticsEvent, properties: EventProperties = {}): Promise<void> {
    try {
      // Ensure Amplitude is initialized first (only on client side)
      if (typeof window !== 'undefined' && !this.isAmplitudeInitialized && !this.amplitudeModule) {
        await this.initializeAmplitude();
      }

      // Track in Amplitude (client-side only)
      if (this.isAmplitudeInitialized && this.amplitudeModule) {
        this.amplitudeModule.track(event, {
          ...properties,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        });
      }
      
      // Store in MongoDB for business intelligence (server-side only)
      if (typeof window === 'undefined') {
        await this.storeInMongoDB(event, properties);
      }
      
      if (this.isDevelopment) {
        console.log('Event tracked:', { event, properties });
      }
    } catch (error) {
      console.error('Failed to track event:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }
  
  /**
   * Track page views
   */
  async trackPageView(page: string, properties: EventProperties = {}): Promise<void> {
    try {
      // Ensure Amplitude is initialized first
      if (!this.isAmplitudeInitialized && !this.amplitudeModule) {
        await this.initializeAmplitude();
      }

      if (this.isAmplitudeInitialized && this.amplitudeModule) {
        this.amplitudeModule.track('page_viewed', {
          page,
          ...properties,
          timestamp: new Date().toISOString(),
        });
      }
      
      if (this.isDevelopment) {
        console.log('Page view tracked:', { page, properties });
      }
    } catch (error) {
      console.error('Failed to track page view:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }
  
  /**
   * Track conversion events with revenue
   */
  async trackRevenue(userId: string, revenue: number, productId?: string): Promise<void> {
    try {
      // Ensure Amplitude is initialized first
      if (!this.isAmplitudeInitialized && !this.amplitudeModule) {
        await this.initializeAmplitude();
      }

      if (this.isAmplitudeInitialized && this.amplitudeModule) {
        const revenueEvent = new this.amplitudeModule.Revenue();
        revenueEvent.setPrice(revenue);
        if (productId) {
          revenueEvent.setProductId(productId);
        }
        revenueEvent.setRevenueType('subscription');
        this.amplitudeModule.revenue(revenueEvent);
      }
      
      // Store revenue event in MongoDB (server-side only)
      if (typeof window === 'undefined') {
        await this.storeInMongoDB('subscription_revenue', {
          userId,
          revenue,
          productId,
          currency: 'EUR',
        });
      }
      
      if (this.isDevelopment) {
        console.log('Revenue tracked:', { userId, revenue, productId });
      }
    } catch (error) {
      console.error('Failed to track revenue:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }
  
  /**
   * Store analytics event in MongoDB for long-term storage and BI
   */
  private async storeInMongoDB(event: string, properties: EventProperties): Promise<void> {
    try {
      // Only store in MongoDB on server-side
      if (typeof window !== 'undefined') {
        return;
      }
      
      // Dynamic imports to avoid build-time issues
      const [mongooseModule, analyticsModel] = await Promise.all([
        import('./mongoose').catch(() => null),
        import('./models/analytics.model').catch(() => null)
      ]);

      if (!mongooseModule || !analyticsModel) {
        console.warn('Database modules not available for analytics storage');
        return;
      }
      
      await mongooseModule.connectToDatabase();
      
      const now = new Date();
      const tenantId = 'default'; // For multi-tenancy support
      
      // Update or create analytics document
      await analyticsModel.default.findOneAndUpdate(
        { tenantId },
        {
          $push: {
            events: {
              event,
              properties,
              timestamp: now,
              userId: properties.userId || 'anonymous',
            },
          },
          $set: {
            updatedAt: now,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );
    } catch (error) {
      console.error('Failed to store event in MongoDB:', error);
      // Don't re-throw to avoid breaking the user experience
    }
  }
  
  /**
   * Flush all pending events (useful before page unload)
   */
  async flush(): Promise<void> {
    try {
      // Ensure Amplitude is initialized first
      if (!this.isAmplitudeInitialized && !this.amplitudeModule) {
        await this.initializeAmplitude();
      }

      if (this.isAmplitudeInitialized && this.amplitudeModule) {
        this.amplitudeModule.flush();
      }
    } catch (error) {
      console.error('Failed to flush analytics:', error);
    }
  }
  
  /**
   * Reset user (useful for logout)
   */
  async reset(): Promise<void> {
    try {
      // Ensure Amplitude is initialized first
      if (!this.isAmplitudeInitialized && !this.amplitudeModule) {
        await this.initializeAmplitude();
      }

      if (this.isAmplitudeInitialized && this.amplitudeModule) {
        this.amplitudeModule.reset();
      }
      
      if (this.isDevelopment) {
        console.log('Analytics reset');
      }
    } catch (error) {
      console.error('Failed to reset analytics:', error);
    }
  }
}

// Create singleton instance
const analytics = new AnalyticsManager();

export default analytics;

// Utility functions for common tracking scenarios
export const trackUserAction = (action: AnalyticsEvent, userId?: string, properties: EventProperties = {}) => {
  analytics.track(action, { ...properties, userId });
};

export const trackError = (error: Error, context: string, userId?: string) => {
  analytics.track('error_occurred', {
    errorMessage: error.message,
    errorStack: error.stack,
    context,
    userId,
  });
  
  // Also send to Sentry with additional context
  if (Sentry?.captureException) {
    Sentry.captureException(error, {
      tags: {
        context,
        userId: userId || 'anonymous',
      },
    });
  }
};

export const trackAPIError = (endpoint: string, statusCode: number, error: string, userId?: string) => {
  analytics.track('api_error', {
    endpoint,
    statusCode,
    error,
    userId,
  });
};

export const trackBusinessMetric = (metric: string, value: number, properties: EventProperties = {}) => {
  analytics.track('business_metric' as AnalyticsEvent, {
    metric,
    value,
    ...properties,
  });
};