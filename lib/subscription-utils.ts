import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/lib/stripe';
import User from '@/lib/models/user.model';
import * as Sentry from '@sentry/nextjs';

// Types for usage enforcement
export interface UsageCheck {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  upgradeRequired?: boolean;
}

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: string;
  isActive: boolean;
  isOnTrial: boolean;
  daysUntilExpiry?: number;
  features: string[];
  limits: {
    maxProducts: number;
    maxApiCalls: number;
    maxEmails: number;
    checkFrequency: number;
  };
}

// Check if user can add more products
export const checkProductLimit = async (clerkUserId: string): Promise<UsageCheck> => {
  try {
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const planKey = (user.subscription?.plan || 'free') as SubscriptionPlan;
    const plan = SUBSCRIPTION_PLANS[planKey];
    const currentCount = user.usage?.productsTracked || 0;
    const maxProducts = plan.maxProducts;

    // Handle unlimited products (enterprise)
    if (maxProducts === Infinity) {
      return { allowed: true, current: currentCount };
    }

    const allowed = currentCount < maxProducts;
    
    return {
      allowed,
      reason: allowed ? undefined : `Product limit reached. Upgrade to track more products.`,
      limit: maxProducts,
      current: currentCount,
      upgradeRequired: !allowed
    };
  } catch (error) {
    console.error('Error checking product limit:', error);
    Sentry.captureException(error);
    return { allowed: false, reason: 'Error checking limits' };
  }
};

// Check if user can make API call
export const checkApiLimit = async (clerkUserId: string): Promise<UsageCheck> => {
  try {
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const planKey = (user.subscription?.plan || 'free') as SubscriptionPlan;
    const plan = SUBSCRIPTION_PLANS[planKey];
    const currentCount = user.usage?.apiCalls || 0;
    const maxApiCalls = user.usage?.maxApiCalls || 0;

    // Check if plan includes API access
    if (maxApiCalls === 0) {
      return {
        allowed: false,
        reason: 'API access not included in current plan. Upgrade to Pro or Enterprise.',
        upgradeRequired: true
      };
    }

    // Handle unlimited API calls (enterprise)
    if (maxApiCalls === -1) {
      return { allowed: true, current: currentCount };
    }

    const allowed = currentCount < maxApiCalls;
    
    return {
      allowed,
      reason: allowed ? undefined : `API limit reached. Reset in ${getDaysUntilReset(user.usage?.resetDate)} days.`,
      limit: maxApiCalls,
      current: currentCount,
      upgradeRequired: !allowed && user.subscription?.plan === 'pro'
    };
  } catch (error) {
    console.error('Error checking API limit:', error);
    Sentry.captureException(error);
    return { allowed: false, reason: 'Error checking limits' };
  }
};

// Check if user can send email
export const checkEmailLimit = async (clerkUserId: string): Promise<UsageCheck> => {
  try {
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const currentCount = user.usage?.emailsSent || 0;
    const maxEmails = user.usage?.maxEmails || 10;

    // Handle unlimited emails (enterprise)
    if (maxEmails === -1) {
      return { allowed: true, current: currentCount };
    }

    const allowed = currentCount < maxEmails;
    
    return {
      allowed,
      reason: allowed ? undefined : `Email limit reached. Upgrade for more notifications.`,
      limit: maxEmails,
      current: currentCount,
      upgradeRequired: !allowed
    };
  } catch (error) {
    console.error('Error checking email limit:', error);
    Sentry.captureException(error);
    return { allowed: false, reason: 'Error checking limits' };
  }
};

// Increment usage counter
export const incrementUsage = async (
  clerkUserId: string,
  type: 'products' | 'apiCalls' | 'emails'
): Promise<boolean> => {
  try {
    const fieldMap = {
      products: 'usage.productsTracked',
      apiCalls: 'usage.apiCalls',
      emails: 'usage.emailsSent'
    };

    const field = fieldMap[type];
    await User.findOneAndUpdate(
      { clerkId: clerkUserId },
      { $inc: { [field]: 1 } }
    );

    return true;
  } catch (error) {
    console.error(`Error incrementing ${type} usage:`, error);
    Sentry.captureException(error);
    return false;
  }
};

// Decrement usage counter (e.g., when product is removed)
export const decrementUsage = async (
  clerkUserId: string,
  type: 'products' | 'apiCalls' | 'emails'
): Promise<boolean> => {
  try {
    const fieldMap = {
      products: 'usage.productsTracked',
      apiCalls: 'usage.apiCalls',
      emails: 'usage.emailsSent'
    };

    const field = fieldMap[type];
    await User.findOneAndUpdate(
      { clerkId: clerkUserId },
      { 
        $inc: { [field]: -1 },
        $max: { [field]: 0 } // Ensure it doesn't go below 0
      }
    );

    return true;
  } catch (error) {
    console.error(`Error decrementing ${type} usage:`, error);
    Sentry.captureException(error);
    return false;
  }
};

// Get comprehensive subscription information
export const getSubscriptionInfo = async (clerkUserId: string): Promise<SubscriptionInfo | null> => {
  try {
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) return null;

    const plan = user.subscription?.plan || 'free';
    const planConfig = SUBSCRIPTION_PLANS[plan as SubscriptionPlan];
    const status = user.subscription?.status || 'active';
    const isActive = status === 'active' && 
                     (!user.subscription?.currentPeriodEnd || 
                      user.subscription.currentPeriodEnd > new Date());
    const isOnTrial = status === 'trialing' &&
                      user.subscription?.trialEnd &&
                      user.subscription.trialEnd > new Date();

    let daysUntilExpiry: number | undefined;
    if (user.subscription?.currentPeriodEnd) {
      const diffTime = user.subscription.currentPeriodEnd.getTime() - new Date().getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      plan,
      status,
      isActive,
      isOnTrial,
      daysUntilExpiry,
      features: [...planConfig.features],
      limits: {
        maxProducts: user.usage?.maxProducts || planConfig.maxProducts,
        maxApiCalls: user.usage?.maxApiCalls || 0,
        maxEmails: user.usage?.maxEmails || 10,
        checkFrequency: planConfig.checkFrequency
      }
    };
  } catch (error) {
    console.error('Error getting subscription info:', error);
    Sentry.captureException(error);
    return null;
  }
};

// Check if user needs to upgrade for a specific feature
export const checkFeatureAccess = async (
  clerkUserId: string,
  feature: 'price_alerts' | 'api_access' | 'priority_support' | 'hourly_checks'
): Promise<UsageCheck> => {
  try {
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const plan = user.subscription?.plan || 'free';
    const planConfig = SUBSCRIPTION_PLANS[plan as SubscriptionPlan];

    const featureAccess = {
      price_alerts: ['pro', 'enterprise'].includes(plan),
      api_access: ['enterprise'].includes(plan),
      priority_support: ['enterprise'].includes(plan),
      hourly_checks: ['enterprise'].includes(plan)
    };

    const allowed = featureAccess[feature] || false;
    
    return {
      allowed,
      reason: allowed ? undefined : `${feature.replace('_', ' ')} requires ${getRequiredPlan(feature)} plan.`,
      upgradeRequired: !allowed
    };
  } catch (error) {
    console.error('Error checking feature access:', error);
    Sentry.captureException(error);
    return { allowed: false, reason: 'Error checking feature access' };
  }
};

// Reset monthly usage (called by cron job)
export const resetMonthlyUsage = async (clerkUserId?: string): Promise<boolean> => {
  try {
    const filter = clerkUserId ? { clerkId: clerkUserId } : {};
    const now = new Date();

    await User.updateMany(
      filter,
      {
        'usage.apiCalls': 0,
        'usage.emailsSent': 0,
        'usage.resetDate': now
      }
    );

    console.log(`Monthly usage reset ${clerkUserId ? `for user ${clerkUserId}` : 'for all users'}`);
    return true;
  } catch (error) {
    console.error('Error resetting monthly usage:', error);
    Sentry.captureException(error);
    return false;
  }
};

// Helper function to get required plan for feature
function getRequiredPlan(feature: string): string {
  const planMap = {
    price_alerts: 'Pro',
    api_access: 'Enterprise',
    priority_support: 'Enterprise',
    hourly_checks: 'Enterprise'
  };
  return planMap[feature as keyof typeof planMap] || 'Pro';
}

// Helper function to calculate days until reset
function getDaysUntilReset(resetDate?: Date): number {
  if (!resetDate) return 30;
  
  const nextReset = new Date(resetDate);
  nextReset.setMonth(nextReset.getMonth() + 1);
  
  const diffTime = nextReset.getTime() - new Date().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Validate subscription status and throw error if inactive
export const requireActiveSubscription = async (clerkUserId: string): Promise<void> => {
  const info = await getSubscriptionInfo(clerkUserId);
  
  if (!info || (!info.isActive && !info.isOnTrial)) {
    throw new Error('Active subscription required');
  }
};

// Get upgrade recommendation based on current usage
export const getUpgradeRecommendation = async (clerkUserId: string): Promise<{
  shouldUpgrade: boolean;
  recommendedPlan?: SubscriptionPlan;
  reason?: string;
} | null> => {
  try {
    const user = await User.findOne({ clerkId: clerkUserId });
    if (!user) return null;

    const currentPlan = user.subscription?.plan || 'free';
    const usage = user.usage;

    if (!usage) return null;

    // Check if user is hitting limits
    const productLimit = await checkProductLimit(clerkUserId);
    const apiLimit = await checkApiLimit(clerkUserId);
    const emailLimit = await checkEmailLimit(clerkUserId);

    // Free to Pro upgrade
    if (currentPlan === 'free') {
      if (!productLimit.allowed || !emailLimit.allowed) {
        return {
          shouldUpgrade: true,
          recommendedPlan: 'pro',
          reason: 'You\'re reaching your limits. Upgrade to Pro for 50 products and more features.'
        };
      }
    }

    // Pro to Enterprise upgrade
    if (currentPlan === 'pro') {
      if (!productLimit.allowed || !apiLimit.allowed) {
        return {
          shouldUpgrade: true,
          recommendedPlan: 'enterprise',
          reason: 'Upgrade to Enterprise for unlimited products and API access.'
        };
      }
    }

    return { shouldUpgrade: false };
  } catch (error) {
    console.error('Error getting upgrade recommendation:', error);
    Sentry.captureException(error);
    return null;
  }
};