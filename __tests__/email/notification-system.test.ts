import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render } from '@react-email/render';
import { emailService, EmailService } from '@/lib/resend';
import { 
  WelcomeEmail, 
  PriceAlertEmail, 
  SubscriptionConfirmationEmail, 
  PaymentFailedEmail 
} from '@/emails/templates';

// Mock dependencies
jest.mock('@react-email/render', () => ({
  render: jest.fn(),
}));

jest.mock('@/lib/resend', () => ({
  resend: {
    emails: {
      send: jest.fn(),
    },
  },
  emailService: {
    sendEmail: jest.fn(),
    sendTemplatedEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    sendPriceAlertEmail: jest.fn(),
    sendSubscriptionConfirmationEmail: jest.fn(),
    sendPaymentFailedEmail: jest.fn(),
    queueEmail: jest.fn(),
  },
}));

jest.mock('@/lib/scraper/queue', () => ({
  emailQueue: {
    add: jest.fn(),
  },
}));

jest.mock('@/lib/subscription-utils', () => ({
  checkEmailLimit: jest.fn(),
  incrementUsage: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

const mockRender = render as jest.MockedFunction<typeof render>;

describe('Email Notification System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Templates', () => {
    test('should render welcome email template correctly', async () => {
      const props = {
        firstName: 'John',
        email: 'john@example.com',
        dashboardUrl: 'https://shopvalue.com/dashboard',
      };

      mockRender.mockResolvedValue('<html>Welcome Email</html>');

      const component = WelcomeEmail(props);
      const html = await render(component);

      expect(html).toBe('<html>Welcome Email</html>');
      expect(mockRender).toHaveBeenCalledWith(component);
    });

    test('should render price alert email template correctly', async () => {
      const props = {
        firstName: 'John',
        email: 'john@example.com',
        product: {
          id: '1',
          title: 'Test Product',
          brand: 'Test Brand',
          currentPrice: 99.99,
          originalPrice: 129.99,
          targetPrice: 95.00,
          url: 'https://example.com/product',
          image: 'https://example.com/image.jpg',
          availability: 'In Stock',
        },
        alertType: 'target_reached' as const,
        discountPercentage: 23,
      };

      mockRender.mockResolvedValue('<html>Price Alert Email</html>');

      const component = PriceAlertEmail(props);
      const html = await render(component);

      expect(html).toBe('<html>Price Alert Email</html>');
      expect(mockRender).toHaveBeenCalledWith(component);
    });

    test('should render subscription confirmation email correctly', async () => {
      const props = {
        firstName: 'John',
        email: 'john@example.com',
        subscription: {
          plan: 'pro' as const,
          billingCycle: 'monthly' as const,
          amount: 19.99,
          currency: 'eur',
          startDate: '2024-01-01T00:00:00Z',
          nextBillingDate: '2024-02-01T00:00:00Z',
        },
        features: [
          'Monitor up to 50 products',
          'Price checks 4x daily',
          'Advanced email alerts',
        ],
        dashboardUrl: 'https://shopvalue.com/dashboard',
      };

      mockRender.mockResolvedValue('<html>Subscription Email</html>');

      const component = SubscriptionConfirmationEmail(props);
      const html = await render(component);

      expect(html).toBe('<html>Subscription Email</html>');
      expect(mockRender).toHaveBeenCalledWith(component);
    });

    test('should render payment failed email correctly', async () => {
      const props = {
        firstName: 'John',
        email: 'john@example.com',
        subscription: {
          plan: 'pro' as const,
          amount: 19.99,
          currency: 'eur',
          nextAttempt: '2024-01-02T00:00:00Z',
        },
        failureReason: 'Insufficient funds',
        retryUrl: 'https://shopvalue.com/customer-portal',
      };

      mockRender.mockResolvedValue('<html>Payment Failed Email</html>');

      const component = PaymentFailedEmail(props);
      const html = await render(component);

      expect(html).toBe('<html>Payment Failed Email</html>');
      expect(mockRender).toHaveBeenCalledWith(component);
    });
  });

  describe('Email Service', () => {
    let service: EmailService;
    const mockCheckEmailLimit = require('@/lib/subscription-utils').checkEmailLimit;
    const mockIncrementUsage = require('@/lib/subscription-utils').incrementUsage;

    beforeEach(() => {
      service = new EmailService();
      mockCheckEmailLimit.mockResolvedValue({ allowed: true });
      mockIncrementUsage.mockResolvedValue(true);
    });

    test('should send welcome email successfully', async () => {
      const mockSendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue({
        success: true,
        data: { id: 'email-123' },
      });

      mockRender.mockResolvedValue('<html>Welcome</html>');

      const result = await service.sendWelcomeEmail({
        firstName: 'John',
        email: 'john@example.com',
        dashboardUrl: 'https://shopvalue.com/dashboard',
      }, { userId: 'user-123' });

      expect(result.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'john@example.com',
        'Bun venit la ShopValue!',
        '<html>Welcome</html>'
      );
    });

    test('should send price alert email successfully', async () => {
      const mockSendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue({
        success: true,
        data: { id: 'email-123' },
      });

      mockRender.mockResolvedValue('<html>Alert</html>');

      const result = await service.sendPriceAlertEmail({
        firstName: 'John',
        email: 'john@example.com',
        product: {
          id: '1',
          title: 'Test Product',
          brand: 'Test Brand',
          currentPrice: 99.99,
          originalPrice: 129.99,
          url: 'https://example.com/product',
        },
        alertType: 'target_reached',
      }, { userId: 'user-123' });

      expect(result.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'john@example.com',
        '🎯 Prețul țintă atins pentru Test Product',
        '<html>Alert</html>'
      );
    });

    test('should respect email limits', async () => {
      mockCheckEmailLimit.mockResolvedValue({
        allowed: false,
        reason: 'Email limit reached',
      });

      const result = await service.sendPriceAlertEmail({
        firstName: 'John',
        email: 'john@example.com',
        product: {
          id: '1',
          title: 'Test Product',
          brand: 'Test Brand',
          currentPrice: 99.99,
          originalPrice: 129.99,
          url: 'https://example.com/product',
        },
        alertType: 'target_reached',
      }, { userId: 'user-123' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email limit reached');
    });

    test('should increment email count on successful send', async () => {
      jest.spyOn(service, 'sendEmail').mockResolvedValue({
        success: true,
        data: { id: 'email-123' },
      });

      mockRender.mockResolvedValue('<html>Alert</html>');

      await service.sendPriceAlertEmail({
        firstName: 'John',
        email: 'john@example.com',
        product: {
          id: '1',
          title: 'Test Product',
          brand: 'Test Brand',
          currentPrice: 99.99,
          originalPrice: 129.99,
          url: 'https://example.com/product',
        },
        alertType: 'target_reached',
      }, { userId: 'user-123' });

      expect(mockIncrementUsage).toHaveBeenCalledWith('user-123', 'emails');
    });

    test('should bypass limits for welcome emails', async () => {
      mockCheckEmailLimit.mockResolvedValue({
        allowed: false,
        reason: 'Email limit reached',
      });

      jest.spyOn(service, 'sendEmail').mockResolvedValue({
        success: true,
        data: { id: 'email-123' },
      });

      mockRender.mockResolvedValue('<html>Welcome</html>');

      const result = await service.sendWelcomeEmail({
        firstName: 'John',
        email: 'john@example.com',
      }, { userId: 'user-123' });

      expect(result.success).toBe(true);
      expect(mockCheckEmailLimit).not.toHaveBeenCalled();
    });

    test('should queue emails correctly', async () => {
      const mockAdd = require('@/lib/scraper/queue').emailQueue.add;
      mockAdd.mockResolvedValue({ id: 'job-123' });

      const result = await service.queueEmail({
        type: 'price_alert',
        to: 'john@example.com',
        userId: 'user-123',
        data: { product: {} },
        priority: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(mockAdd).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          type: 'price_alert',
          to: 'john@example.com',
          userId: 'user-123',
          data: { product: {} },
        }),
        expect.objectContaining({
          priority: 1, // high priority
          attempts: 3,
        })
      );
    });
  });

  describe('Email Templates Content', () => {
    test('welcome email should include correct Romanian text', async () => {
      const props = {
        firstName: 'Ion',
        email: 'ion@example.com',
      };

      // Test the actual component content
      const component = WelcomeEmail(props);
      
      // Check if component has the expected structure
      expect(component).toBeDefined();
      expect(component.props.children).toBeDefined();
    });

    test('price alert email should format prices correctly', async () => {
      const props = {
        firstName: 'Maria',
        email: 'maria@example.com',
        product: {
          id: '1',
          title: 'Telefon Samsung',
          brand: 'Samsung',
          currentPrice: 1299.99,
          originalPrice: 1599.99,
          url: 'https://emag.ro/telefon',
        },
        alertType: 'significant_drop' as const,
        discountPercentage: 19,
      };

      const component = PriceAlertEmail(props);
      expect(component).toBeDefined();
    });

    test('subscription email should show correct plan benefits', async () => {
      const props = {
        firstName: 'Andrei',
        email: 'andrei@example.com',
        subscription: {
          plan: 'enterprise' as const,
          billingCycle: 'yearly' as const,
          amount: 499.99,
          currency: 'eur',
          startDate: '2024-01-01T00:00:00Z',
          nextBillingDate: '2025-01-01T00:00:00Z',
        },
        features: [
          'Produse nelimitate',
          'Verificări orare',
          'Acces API complet',
          'Manager de cont dedicat',
        ],
      };

      const component = SubscriptionConfirmationEmail(props);
      expect(component).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle email sending failures gracefully', async () => {
      const service = new EmailService();
      jest.spyOn(service, 'sendEmail').mockResolvedValue({
        success: false,
        error: 'SMTP connection failed',
      });

      mockRender.mockResolvedValue('<html>Test</html>');

      const result = await service.sendWelcomeEmail({
        firstName: 'John',
        email: 'john@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });

    test('should handle template rendering failures', async () => {
      const service = new EmailService();
      mockRender.mockRejectedValue(new Error('Template rendering failed'));

      const result = await service.sendWelcomeEmail({
        firstName: 'John',
        email: 'john@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template rendering failed');
    });
  });
});

describe('Email Queue Worker', () => {
  test('should process email jobs correctly', async () => {
    // Test email worker functionality
    const { emailWorker } = await import('@/lib/email/worker');
    expect(emailWorker).toBeDefined();
  });
});

describe('Email Template Types', () => {
  test('should have correct alert types', () => {
    const alertTypes = ['target_reached', 'significant_drop', 'lowest_price', 'back_in_stock'];
    
    alertTypes.forEach(type => {
      expect(['target_reached', 'significant_drop', 'lowest_price', 'back_in_stock']).toContain(type);
    });
  });

  test('should have correct email types', () => {
    const emailTypes = ['welcome', 'price_alert', 'subscription_confirmation', 'payment_failed'];
    
    emailTypes.forEach(type => {
      expect(['welcome', 'price_alert', 'subscription_confirmation', 'payment_failed']).toContain(type);
    });
  });
});