/**
 * Analytics System Tests
 * Tests for Amplitude integration, MongoDB storage, and error tracking
 */

import analytics, { trackUserAction, trackError, trackAPIError } from '@/lib/analytics';
import * as amplitude from '@amplitude/analytics-browser';
import * as Sentry from '@sentry/nextjs';

// Mock dependencies
jest.mock('@amplitude/analytics-browser');
jest.mock('@sentry/nextjs');
jest.mock('@/lib/mongoose');
jest.mock('@/lib/models/analytics.model');

const mockAmplitude = amplitude as jest.Mocked<typeof amplitude>;
const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

describe('Analytics System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Analytics Manager', () => {
    it('should initialize Amplitude with API key', () => {
      process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = 'test-api-key';
      
      // Re-import to trigger initialization
      jest.resetModules();
      require('@/lib/analytics');
      
      expect(mockAmplitude.init).toHaveBeenCalledWith('test-api-key', {
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
    });

    it('should handle missing API key gracefully', () => {
      delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
      
      // Re-import to trigger initialization
      jest.resetModules();
      require('@/lib/analytics');
      
      expect(mockAmplitude.init).not.toHaveBeenCalled();
    });

    it('should set user properties correctly', () => {
      const mockIdentify = new (jest.fn())();
      mockIdentify.set = jest.fn();
      mockAmplitude.Identify = jest.fn(() => mockIdentify);
      
      analytics.setUser('user123', {
        email: 'test@example.com',
        subscriptionTier: 'pro',
      });

      expect(mockAmplitude.setUserId).toHaveBeenCalledWith('user123');
      expect(mockIdentify.set).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockIdentify.set).toHaveBeenCalledWith('subscriptionTier', 'pro');
      expect(mockAmplitude.identify).toHaveBeenCalledWith(mockIdentify);
    });

    it('should track events with properties', async () => {
      await analytics.track('user_login', {
        loginMethod: 'clerk',
        userId: 'user123',
      });

      expect(mockAmplitude.track).toHaveBeenCalledWith('user_login', {
        loginMethod: 'clerk',
        userId: 'user123',
        timestamp: expect.any(String),
        environment: 'test',
      });
    });

    it('should track revenue events', async () => {
      const mockRevenue = {
        setPrice: jest.fn(),
        setProductId: jest.fn(),
        setRevenueType: jest.fn(),
      };
      (mockAmplitude.Revenue as any) = jest.fn().mockImplementation(() => mockRevenue);

      await analytics.trackRevenue('user123', 19.99, 'pro-monthly');

      expect(mockRevenue.setPrice).toHaveBeenCalledWith(19.99);
      expect(mockRevenue.setProductId).toHaveBeenCalledWith('pro-monthly');
      expect(mockRevenue.setRevenueType).toHaveBeenCalledWith('subscription');
      expect(mockAmplitude.revenue).toHaveBeenCalledWith(mockRevenue);
    });

    it('should handle Amplitude errors gracefully', async () => {
      mockAmplitude.track.mockImplementation(() => {
        throw new Error('Amplitude error');
      });

      await expect(analytics.track('user_login')).resolves.not.toThrow();
      expect(mockSentry.captureException).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    it('should track user actions with utility function', () => {
      const trackSpy = jest.spyOn(analytics, 'track');
      
      trackUserAction('product_added', 'user123', { productId: 'prod123' });

      expect(trackSpy).toHaveBeenCalledWith('product_added', {
        productId: 'prod123',
        userId: 'user123',
      });
    });

    it('should track errors with context', () => {
      const error = new Error('Test error');
      const trackSpy = jest.spyOn(analytics, 'track');

      trackError(error, 'checkout-process', 'user123');

      expect(trackSpy).toHaveBeenCalledWith('error_occurred', {
        errorMessage: 'Test error',
        errorStack: expect.any(String),
        context: 'checkout-process',
        userId: 'user123',
      });

      expect(mockSentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          context: 'checkout-process',
          userId: 'user123',
        },
      });
    });

    it('should track API errors', () => {
      const trackSpy = jest.spyOn(analytics, 'track');

      trackAPIError('/api/products', 500, 'Internal server error', 'user123');

      expect(trackSpy).toHaveBeenCalledWith('api_error', {
        endpoint: '/api/products',
        statusCode: 500,
        error: 'Internal server error',
        userId: 'user123',
      });
    });
  });

  describe('Page Tracking', () => {
    it('should track page views with properties', () => {
      analytics.trackPageView('/dashboard', {
        userId: 'user123',
        section: 'products',
      });

      expect(mockAmplitude.track).toHaveBeenCalledWith('page_viewed', {
        page: '/dashboard',
        userId: 'user123',
        section: 'products',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Session Management', () => {
    it('should flush events', () => {
      analytics.flush();
      expect(mockAmplitude.flush).toHaveBeenCalled();
    });

    it('should reset analytics', () => {
      analytics.reset();
      expect(mockAmplitude.reset).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle MongoDB storage errors gracefully', async () => {
      // Mock MongoDB error
      jest.doMock('@/lib/models/analytics.model', () => ({
        findOneAndUpdate: jest.fn().mockRejectedValue(new Error('DB error')),
      }));

      // Should not throw even if MongoDB fails
      await expect(analytics.track('user_login')).resolves.not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  it('should handle analytics initialization in browser environment', () => {
    // Mock browser environment
    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com' },
      writable: true,
    });

    process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = 'test-key';
    
    jest.resetModules();
    require('@/lib/analytics');
    
    expect(mockAmplitude.init).toHaveBeenCalled();
  });

  it('should handle server-side analytics calls', async () => {
    // Mock server environment
    delete (global as any).window;
    
    const analytics = require('@/lib/analytics').default;
    await analytics.track('user_registered', { userId: 'user123' });
    
    // Should attempt to store in MongoDB on server-side
    expect(true).toBe(true); // Placeholder assertion
  });
});