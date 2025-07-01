// Suppress Mongoose Jest warnings
process.env.SUPPRESS_JEST_WARNINGS = 'true';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/shopvalue_test';
process.env.CLERK_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing';
process.env.CLERK_WEBHOOK_SECRET = 'whsec_mock_webhook_secret_for_testing';