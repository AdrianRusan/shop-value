import { z } from 'zod';

// Product validation schemas
export const productUrlSchema = z.object({
  url: z.string().url('Please provide a valid URL'),
});

export const productAddSchema = z.object({
  url: z.string().url('Please provide a valid URL'),
  priceThreshold: z.number().positive('Price threshold must be positive').optional(),
  notifyOnDrop: z.boolean().default(true),
});

export const productUpdateSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
  priceThreshold: z.number().positive('Price threshold must be positive').optional(),
  notifyOnDrop: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// User validation schemas
export const userPreferencesSchema = z.object({
  currency: z.enum(['RON', 'EUR', 'USD']).default('RON'),
  language: z.enum(['ro', 'en']).default('ro'),
  timezone: z.string().default('Europe/Bucharest'),
  notifications: z.object({
    email: z.boolean().default(true),
    priceAlerts: z.boolean().default(false),
    weeklyReport: z.boolean().default(false),
    marketingEmails: z.boolean().default(false),
  }),
  dashboard: z.object({
    defaultView: z.enum(['grid', 'list', 'analytics']).default('grid'),
    itemsPerPage: z.number().min(6).max(48).default(12),
  }),
});

export const userUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  preferences: userPreferencesSchema.partial().optional(),
});

// Subscription validation schemas
export const subscriptionCreateSchema = z.object({
  planId: z.enum(['pro', 'enterprise'], {
    errorMap: () => ({ message: 'Invalid subscription plan' })
  }),
  billing: z.enum(['monthly', 'yearly'], {
    errorMap: () => ({ message: 'Invalid billing cycle' })
  }),
});

// API validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(100),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

// Webhook validation schemas
export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string(),
  data: z.object({
    object: z.record(z.any()),
  }),
});

export const clerkWebhookSchema = z.object({
  type: z.string(),
  data: z.record(z.any()),
});

// Contact/Support validation schemas
export const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email('Please provide a valid email'),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(2000),
  category: z.enum(['support', 'billing', 'feature', 'bug', 'other']).default('support'),
});

// Analytics validation schemas
export const analyticsEventSchema = z.object({
  event: z.string().min(1).max(50),
  userId: z.string().optional(),
  properties: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date()),
});

// Price alert validation schema
export const priceAlertSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  threshold: z.number().positive('Threshold must be positive'),
  type: z.enum(['below', 'above', 'percent_drop']).default('below'),
  enabled: z.boolean().default(true),
});

// Export validation helper function
export const validateInput = <T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      success: false,
      errors: ['Validation failed']
    };
  }
};