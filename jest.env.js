// Suppress Mongoose Jest warnings
process.env.SUPPRESS_JEST_WARNINGS = 'true';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Database
process.env.MONGODB_URI = 'mongodb://localhost:27017/shopvalue_test';

// Authentication (Clerk)
process.env.CLERK_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing';
process.env.CLERK_WEBHOOK_SECRET = 'whsec_mock_webhook_secret_for_testing';

// Payments (Stripe)
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_stripe_key_for_testing';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_stripe_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_stripe_webhook_for_testing';

// Redis (Upstash)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis-url.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock_redis_token_for_testing';

// Email (Resend)
process.env.RESEND_API_KEY = 're_mock_resend_key_for_testing';

// Analytics
process.env.AMPLITUDE_API_KEY = 'mock_amplitude_key_for_testing';
process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = 'mock_amplitude_public_key';

// Security
process.env.NEXTAUTH_SECRET = 'mock_nextauth_secret_for_testing';
process.env.ENCRYPTION_KEY = 'mock_encryption_key_for_testing_32_chars';

// Feature flags
process.env.ENABLE_NOTIFICATIONS = 'false';
process.env.ENABLE_ANALYTICS = 'false';
process.env.ENABLE_REAL_PAYMENTS = 'false';