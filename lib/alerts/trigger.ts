'use server';

import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import { sendEmail, generateEmailBody } from '@/lib/nodemailer';
import { connectToDatabase } from '@/lib/mongoose';

/**
 * Check all tracked products and send alerts when ROI threshold is met
 * This function is designed to be called by a cron job
 */
export async function checkAndSendAlerts() {
  try {
    await connectToDatabase();
    
    // Find all active products with alerts enabled
    const products = await Product.find({ 
      status: 'active',
      alertEnabled: true,
      roiPercentage: { $exists: true, $ne: null }
    });

    console.log(`[Alerts] Checking ${products.length} products for alert conditions`);
    
    let alertsSent = 0;
    let alertsSkipped = 0;

    for (const product of products) {
      try {
        // Check if ROI exceeds threshold
        if (product.roiPercentage < product.roiThreshold) {
          alertsSkipped++;
          continue;
        }

        // Check if already alerted in last 24 hours (prevent spam)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (product.lastAlertSentAt && product.lastAlertSentAt > dayAgo) {
          alertsSkipped++;
          console.log(`[Alerts] Skipping product ${product._id} - alert sent within 24h`);
          continue;
        }

        // Get user email
        const user = await User.findOne({ clerkId: product.userId });
        if (!user || !user.email) {
          console.error(`[Alerts] User not found for product ${product._id}`);
          continue;
        }

        // Check if user has email notification enabled
        if (!user.preferences?.notifications?.priceAlerts) {
          alertsSkipped++;
          console.log(`[Alerts] Skipping product ${product._id} - user disabled alerts`);
          continue;
        }

        // Check user's email limit
        if (user.usage.emailsSent >= user.usage.maxEmails) {
          console.warn(`[Alerts] User ${user.email} reached email limit`);
          continue;
        }

        // Prepare email content
        const emailContent = await generateArbitrageAlertEmail(product);
        
        // Send alert
        await sendEmail(emailContent, [user.email]);
        
        // Update last alert sent timestamp
        product.lastAlertSentAt = new Date();
        await product.save();

        // Increment user's email usage
        await user.incrementUsage('emails');
        
        alertsSent++;
        console.log(`[Alerts] Alert sent for product ${product._id} to ${user.email}`);
        
      } catch (error) {
        console.error(`[Alerts] Error processing product ${product._id}:`, error);
      }
    }

    console.log(`[Alerts] Complete. Sent: ${alertsSent}, Skipped: ${alertsSkipped}`);
    
    return {
      success: true,
      alertsSent,
      alertsSkipped,
      totalChecked: products.length
    };
    
  } catch (error) {
    console.error('[Alerts] Error in checkAndSendAlerts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate email content for arbitrage opportunity alert
 */
async function generateArbitrageAlertEmail(product: any) {
  const roiPercentage = product.roiPercentage.toFixed(1);
  const profitAmount = (product.priceDelta || 0).toFixed(2);
  
  // Determine which retailer has lowest and highest price
  const retailers = [
    { name: 'Amazon', price: product.prices.amazon?.price, url: product.prices.amazon?.url },
    { name: 'Walmart', price: product.prices.walmart?.price, url: product.prices.walmart?.url },
    { name: 'Target', price: product.prices.target?.price, url: product.prices.target?.url }
  ].filter(r => r.price && r.price > 0);

  const lowestRetailer = retailers.find(r => r.price === product.lowestPrice);
  const highestRetailer = retailers.find(r => r.price === product.highestPrice);

  const subject = `🚨 ${roiPercentage}% ROI Opportunity - ${product.title}`;
  
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f9fc;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #00b894; margin: 0; font-size: 24px;">
            🚨 ${roiPercentage}% ROI Opportunity!
          </h1>
        </div>

        <!-- Product Image -->
        ${product.imageUrl ? `
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${product.imageUrl}" alt="${product.title}" style="max-width: 200px; border-radius: 8px;" />
          </div>
        ` : ''}

        <!-- Product Title -->
        <h2 style="color: #2d3748; font-size: 18px; margin-bottom: 20px; text-align: center;">
          ${product.title}
        </h2>

        <!-- Price Comparison -->
        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #4a5568; font-size: 16px; margin-top: 0;">Price Comparison:</h3>
          
          ${product.prices.amazon?.price ? `
            <div style="margin-bottom: 10px;">
              <strong>Amazon:</strong> $${product.prices.amazon.price.toFixed(2)}
              ${product.prices.amazon.url ? `<a href="${product.prices.amazon.url}" style="color: #0070f3; text-decoration: none; margin-left: 10px;">View →</a>` : ''}
            </div>
          ` : ''}
          
          ${product.prices.walmart?.price ? `
            <div style="margin-bottom: 10px;">
              <strong>Walmart:</strong> $${product.prices.walmart.price.toFixed(2)}
              ${product.prices.walmart.url ? `<a href="${product.prices.walmart.url}" style="color: #0070f3; text-decoration: none; margin-left: 10px;">View →</a>` : ''}
            </div>
          ` : ''}
          
          ${product.prices.target?.price ? `
            <div style="margin-bottom: 10px;">
              <strong>Target:</strong> $${product.prices.target.price.toFixed(2)}
              ${product.prices.target.url ? `<a href="${product.prices.target.url}" style="color: #0070f3; text-decoration: none; margin-left: 10px;">View →</a>` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Profit Opportunity -->
        <div style="background-color: #c6f6d5; padding: 20px; border-radius: 8px; border-left: 4px solid #00b894; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #2d3748; margin-bottom: 10px;">
            💡 <strong>Arbitrage Opportunity:</strong>
          </div>
          <div style="font-size: 16px; color: #2d3748; margin-bottom: 5px;">
            Buy from <strong>${lowestRetailer?.name}</strong> at $${product.lowestPrice.toFixed(2)}
          </div>
          <div style="font-size: 16px; color: #2d3748; margin-bottom: 10px;">
            Sell on <strong>${highestRetailer?.name}</strong> at $${product.highestPrice.toFixed(2)}
          </div>
          <div style="font-size: 24px; color: #00b894; font-weight: bold;">
            Profit: $${profitAmount} (${roiPercentage}% ROI)
          </div>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://stockwatch.io'}/dashboard" 
             style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            View in Dashboard
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 12px; color: #718096; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 5px 0;">This alert was triggered because the ROI exceeded your ${product.roiThreshold}% threshold.</p>
          <p style="margin: 5px 0;">You can adjust your alert settings in your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://stockwatch.io'}/dashboard" style="color: #0070f3;">dashboard</a>.</p>
          <p style="margin: 15px 0 5px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://stockwatch.io'}" style="color: #0070f3; text-decoration: none;">StockWatch</a> - Find Profitable Arbitrage Deals
          </p>
        </div>

      </div>
    </div>
  `;

  return { subject, body };
}

/**
 * Send alert for a specific product (manual trigger)
 */
export async function sendAlertForProduct(productId: string) {
  try {
    await connectToDatabase();
    
    const product = await Product.findById(productId);
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const user = await User.findOne({ clerkId: product.userId });
    if (!user || !user.email) {
      return { success: false, error: 'User not found' };
    }

    // Check user's email limit
    if (user.usage.emailsSent >= user.usage.maxEmails) {
      return { success: false, error: 'Email limit reached' };
    }

    const emailContent = await generateArbitrageAlertEmail(product);
    await sendEmail(emailContent, [user.email]);

    // Update last alert sent
    product.lastAlertSentAt = new Date();
    await product.save();

    // Increment email usage
    await user.incrementUsage('emails');

    return { success: true };
    
  } catch (error) {
    console.error('[Alerts] Error sending alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user's email address from clerkId
 */
async function getUserEmail(clerkId: string): Promise<string | null> {
  try {
    const user = await User.findOne({ clerkId });
    return user?.email || null;
  } catch (error) {
    console.error('[Alerts] Error fetching user email:', error);
    return null;
  }
}
