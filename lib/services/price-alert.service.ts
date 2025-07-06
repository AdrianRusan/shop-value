import * as Sentry from '@sentry/nextjs';
import { emailService } from '@/lib/resend';
import { trackBusinessMetric } from '@/lib/analytics';

// Types for alert processing
export interface AlertTrigger {
  alertId: string;
  userId: string;
  productId: string;
  alertType: 'target_reached' | 'significant_drop' | 'lowest_price' | 'back_in_stock';
  currentPrice: number;
  previousPrice: number;
  targetPrice?: number;
  discountPercentage?: number;
  product: {
    id: string;
    title: string;
    brand: string;
    url: string;
    image?: string;
    availability?: string;
  };
}

export interface AlertCheckResult {
  shouldTrigger: boolean;
  alertType?: 'target_reached' | 'significant_drop' | 'lowest_price' | 'back_in_stock';
  discountPercentage?: number;
  reason?: string;
}

/**
 * Price Alert Service
 * Handles price alert detection, triggering, and processing
 */
export class PriceAlertService {
  
  /**
   * Check if a price change should trigger an alert
   */
  static checkPriceAlert(
    alertConfig: {
      alertType: string;
      targetPrice?: number;
      percentageThreshold?: number;
      significantDropAmount?: number;
    },
    priceData: {
      currentPrice: number;
      previousPrice: number;
      lowestPrice: number;
      isOutOfStock: boolean;
      wasOutOfStock: boolean;
    }
  ): AlertCheckResult {
    const { alertType, targetPrice, percentageThreshold, significantDropAmount } = alertConfig;
    const { currentPrice, previousPrice, lowestPrice, isOutOfStock, wasOutOfStock } = priceData;

    try {
      // Back in stock alert
      if (alertType === 'back_in_stock') {
        if (wasOutOfStock && !isOutOfStock) {
          return {
            shouldTrigger: true,
            alertType: 'back_in_stock',
            reason: 'Product is back in stock'
          };
        }
        return { shouldTrigger: false, reason: 'Product stock status unchanged' };
      }

      // Skip if product is out of stock (except for back_in_stock alerts)
      if (isOutOfStock) {
        return { shouldTrigger: false, reason: 'Product is out of stock' };
      }

      // Target price alert
      if (alertType === 'target_price' && targetPrice) {
        if (currentPrice <= targetPrice && previousPrice > targetPrice) {
          return {
            shouldTrigger: true,
            alertType: 'target_reached',
            reason: `Target price of ${targetPrice} reached`
          };
        }
        return { shouldTrigger: false, reason: 'Target price not reached' };
      }

      // Percentage drop alert
      if (alertType === 'percentage_drop' && percentageThreshold) {
        const dropPercentage = ((previousPrice - currentPrice) / previousPrice) * 100;
        if (dropPercentage >= percentageThreshold) {
          return {
            shouldTrigger: true,
            alertType: 'significant_drop',
            discountPercentage: Math.round(dropPercentage),
            reason: `Price dropped by ${Math.round(dropPercentage)}%`
          };
        }
        return { shouldTrigger: false, reason: 'Percentage threshold not reached' };
      }

      // Significant drop alert (fixed amount)
      if (alertType === 'significant_drop' && significantDropAmount) {
        const dropAmount = previousPrice - currentPrice;
        if (dropAmount >= significantDropAmount) {
          const dropPercentage = (dropAmount / previousPrice) * 100;
          return {
            shouldTrigger: true,
            alertType: 'significant_drop',
            discountPercentage: Math.round(dropPercentage),
            reason: `Price dropped by ${dropAmount} RON`
          };
        }
        return { shouldTrigger: false, reason: 'Significant drop amount not reached' };
      }

      // Any drop alert
      if (alertType === 'any_drop') {
        if (currentPrice < previousPrice) {
          const dropPercentage = ((previousPrice - currentPrice) / previousPrice) * 100;
          
          // Determine alert type based on drop significance
          let triggerType: 'significant_drop' | 'lowest_price' = 'significant_drop';
          if (currentPrice <= lowestPrice) {
            triggerType = 'lowest_price';
          }
          
          return {
            shouldTrigger: true,
            alertType: triggerType,
            discountPercentage: Math.round(dropPercentage),
            reason: `Price dropped from ${previousPrice} to ${currentPrice}`
          };
        }
        return { shouldTrigger: false, reason: 'No price drop detected' };
      }

      return { shouldTrigger: false, reason: 'Unknown alert type' };

    } catch (error) {
      console.error('Error checking price alert:', error);
      Sentry.captureException(error);
      return { shouldTrigger: false, reason: 'Error during alert check' };
    }
  }

  /**
   * Process and send price alert
   */
  static async processPriceAlert(trigger: AlertTrigger): Promise<{
    success: boolean;
    emailSent?: boolean;
    error?: string;
  }> {
    try {
      console.log(`Processing price alert for product ${trigger.productId}, user ${trigger.userId}`);

      // Get user information
      const user = await this.getUserData(trigger.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check if user can receive price alerts (subscription tier)
      const canReceiveAlerts = await this.checkAlertPermissions(trigger.userId);
      if (!canReceiveAlerts.allowed) {
        return { 
          success: false, 
          error: canReceiveAlerts.reason 
        };
      }

      // Send price alert email
      const emailResult = await emailService.sendPriceAlertEmail({
        firstName: user.firstName,
        email: user.email,
        product: {
          id: trigger.product.id,
          title: trigger.product.title,
          brand: trigger.product.brand,
          currentPrice: trigger.currentPrice,
          originalPrice: trigger.previousPrice,
          targetPrice: trigger.targetPrice,
          url: trigger.product.url,
          image: trigger.product.image,
          availability: trigger.product.availability,
        },
        alertType: trigger.alertType,
        discountPercentage: trigger.discountPercentage,
      }, { userId: trigger.userId });

      if (!emailResult.success) {
        // Check if it's an email limit issue
        if (emailResult.error && emailResult.error.includes('limit')) {
          console.log(`Email limit reached for user ${trigger.userId}`);
          return { 
            success: true, 
            emailSent: false, 
            error: 'Email limit reached' 
          };
        }
        
        return { 
          success: false, 
          error: emailResult.error || 'Failed to send email' 
        };
      }

      // Track analytics event
      await trackBusinessMetric('price_alert_triggered', 1, {
        user_id: trigger.userId,
        product_id: trigger.productId,
        alert_type: trigger.alertType,
        current_price: trigger.currentPrice,
        previous_price: trigger.previousPrice,
        discount_percentage: trigger.discountPercentage,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Price alert processed successfully for user ${trigger.userId}`);
      return { success: true, emailSent: true };

    } catch (error) {
      console.error('Error processing price alert:', error);
      Sentry.captureException(error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Process alerts for a product after price scraping
   */
  static async processProductAlerts(productData: {
    productId: string;
    currentPrice: number;
    previousPrice: number;
    lowestPrice: number;
    isOutOfStock: boolean;
    wasOutOfStock: boolean;
    product: {
      id: string;
      title: string;
      brand: string;
      url: string;
      image?: string;
      availability?: string;
    };
  }): Promise<{
    processed: number;
    triggered: number;
    errors: number;
  }> {
    const stats = { processed: 0, triggered: 0, errors: 0 };

    try {
      // Get all active alerts for this product
      const alerts = await this.getProductAlerts(productData.productId);
      stats.processed = alerts.length;

      if (alerts.length === 0) {
        console.log(`No active alerts found for product ${productData.productId}`);
        return stats;
      }

      console.log(`Processing ${alerts.length} alerts for product ${productData.productId}`);

      // Process each alert
      for (const alert of alerts) {
        try {
          // Check if alert can be triggered (frequency limits, etc.)
          if (!alert.canTriggerAlert()) {
            console.log(`Alert ${alert._id} cannot be triggered (frequency/limit restrictions)`);
            continue;
          }

          // Check if price change should trigger alert
          const checkResult = this.checkPriceAlert({
            alertType: alert.alertType,
            targetPrice: alert.targetPrice,
            percentageThreshold: alert.percentageThreshold,
            significantDropAmount: alert.significantDropAmount,
          }, {
            currentPrice: productData.currentPrice,
            previousPrice: productData.previousPrice,
            lowestPrice: productData.lowestPrice,
            isOutOfStock: productData.isOutOfStock,
            wasOutOfStock: productData.wasOutOfStock,
          });

          if (checkResult.shouldTrigger && checkResult.alertType) {
            // Create alert trigger
            const trigger: AlertTrigger = {
              alertId: alert._id.toString(),
              userId: alert.userId,
              productId: productData.productId,
              alertType: checkResult.alertType,
              currentPrice: productData.currentPrice,
              previousPrice: productData.previousPrice,
              targetPrice: alert.targetPrice,
              discountPercentage: checkResult.discountPercentage,
              product: productData.product,
            };

            // Process the alert
            const result = await this.processPriceAlert(trigger);
            
            if (result.success) {
              stats.triggered++;
              
              // Record alert trigger in database
              await alert.recordAlertTrigger();
              
              console.log(`✅ Alert triggered for user ${alert.userId}: ${checkResult.reason}`);
            } else {
              stats.errors++;
              console.error(`❌ Failed to process alert for user ${alert.userId}: ${result.error}`);
            }
          } else {
            console.log(`Alert ${alert._id} not triggered: ${checkResult.reason}`);
          }

        } catch (error) {
          stats.errors++;
          console.error(`Error processing alert ${alert._id}:`, error);
          Sentry.captureException(error);
        }
      }

      console.log(`Alert processing complete for product ${productData.productId}: ${stats.triggered}/${stats.processed} triggered`);
      return stats;

    } catch (error) {
      console.error('Error processing product alerts:', error);
      Sentry.captureException(error);
      stats.errors++;
      return stats;
    }
  }

  /**
   * Get user data for alert processing
   */
  private static async getUserData(userId: string): Promise<{
    firstName: string;
    email: string;
  } | null> {
    try {
      // Dynamic imports to avoid build-time database connections
      const [mongoose, userModel] = await Promise.all([
        import('@/lib/mongoose').catch(() => null),
        import('@/lib/models/user.model').catch(() => null)
      ]);
      
      if (!mongoose || !userModel) {
        console.warn('Database modules not available');
        return null;
      }
      
      await mongoose.connectToDB();
      
      const user = await userModel.default.findOne({ clerkId: userId }).lean();
      return user ? {
        firstName: (user as any).firstName || '',
        email: (user as any).email,
      } : null;
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  /**
   * Check if user can receive price alerts based on subscription
   */
  private static async checkAlertPermissions(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    try {
      const { checkFeatureAccess } = await import('@/lib/subscription-utils');
      const access = await checkFeatureAccess(userId, 'price_alerts');
      return {
        allowed: access.allowed,
        reason: access.reason
      };
    } catch (error) {
      console.error('Error checking alert permissions:', error);
      // Allow by default if check fails to avoid blocking legitimate alerts
      return { allowed: true };
    }
  }

  /**
   * Get alerts for a specific product
   */
  private static async getProductAlerts(productId: string): Promise<any[]> {
    try {
      const [mongoose, alertModel] = await Promise.all([
        import('@/lib/mongoose').catch(() => null),
        import('@/lib/models/price-alert.model').catch(() => null)
      ]);
      
      if (!mongoose || !alertModel) {
        console.warn('Alert model not available');
        return [];
      }
      
      await mongoose.connectToDB();
      return await alertModel.default.findAlertsForProduct(productId);
      
    } catch (error) {
      console.error('Error fetching product alerts:', error);
      return [];
    }
  }
}

// Export for use in background jobs
export default PriceAlertService;