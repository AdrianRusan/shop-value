import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/products/user/[userId]/route';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import UserProductTracking from '@/lib/models/user-product-tracking.model';
import User from '@/lib/models/user.model';
import { auth } from '@clerk/nextjs';

// Mock dependencies
jest.mock('@/lib/mongoose');
jest.mock('@/lib/models/product.model');
jest.mock('@/lib/models/user-product-tracking.model');
jest.mock('@/lib/models/user.model');
jest.mock('@clerk/nextjs');
jest.mock('@/lib/redis', () => ({
  redis: {
    incr: jest.fn(),
    setex: jest.fn(),
    get: jest.fn()
  }
}));
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: {
    slidingWindow: jest.fn()
  }
}));
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn()
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockConnectToDB = connectToDB as jest.MockedFunction<typeof connectToDB>;
const mockProduct = Product as jest.Mocked<typeof Product>;
const mockUserProductTracking = UserProductTracking as jest.Mocked<typeof UserProductTracking>;
const mockUser = User as jest.Mocked<typeof User>;

// Test data
const mockUserId = 'user_123';
const mockProductId = '507f1f77bcf86cd799439011';

const mockUserData = {
  _id: 'user_mongo_id',
  clerkId: mockUserId,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  subscription: { plan: 'pro', status: 'active' },
  usage: { productsTracked: 5, maxProducts: 50 },
  canTrackMoreProducts: jest.fn().mockReturnValue(true),
  incrementUsage: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(true)
};

const mockProductData = {
  _id: mockProductId,
  title: 'Test Product',
  brand: 'TestBrand',
  category: 'Electronics',
  currentPrice: 100,
  originalPrice: 120,
  currency: 'RON',
  image: 'test-image.jpg',
  isOutOfStock: false,
  url: 'https://example.com/product'
};

const mockTrackingData = {
  _id: 'tracking_id',
  userId: mockUserId,
  productId: mockProductId,
  isActive: true,
  alertSettings: {
    priceDecrease: true,
    priceIncrease: false,
    backInStock: true,
    frequency: 'immediate'
  },
  addedAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
  populate: jest.fn().mockReturnThis()
};

// Mock rate limiter
const mockRateLimit = {
  limit: jest.fn().mockResolvedValue({ success: true })
};

describe('User Product Tracking API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockAuth.mockReturnValue({ userId: mockUserId });
    mockConnectToDB.mockResolvedValue(undefined);
    
    // Mock Ratelimit constructor
    (require('@upstash/ratelimit').Ratelimit as any).mockImplementation(() => mockRateLimit);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/products/user/[userId]', () => {
    test('should return user tracked products with pagination', async () => {
      // Setup mocks
      mockUserProductTracking.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  { ...mockTrackingData, productId: mockProductData }
                ])
              })
            })
          })
        })
      } as any);

      mockUserProductTracking.countDocuments.mockResolvedValue(1);

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.products).toHaveLength(1);
      expect(data.data.pagination.total).toBe(1);
      expect(data.data.summary).toHaveProperty('totalTracked');
    });

    test('should return 401 for unauthenticated users', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    test('should return 403 for accessing other user data', async () => {
      mockAuth.mockReturnValue({ userId: 'different_user' });

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    test('should handle rate limiting', async () => {
      mockRateLimit.limit.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
    });

    test('should filter by category when provided', async () => {
      mockUserProductTracking.find.mockReturnValue({
        populate: jest.fn().mockImplementation((options) => {
          expect(options.match).toEqual({ category: new RegExp('electronics', 'i') });
          return {
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([])
                })
              })
            })
          };
        })
      } as any);

      mockUserProductTracking.countDocuments.mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/products/user/user_123?category=electronics');
      const response = await GET(request, { params: { userId: mockUserId } });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/products/user/[userId]', () => {
    test('should successfully track a new product', async () => {
      // Setup mocks
      mockUser.findOne.mockResolvedValue(mockUserData);
      mockProduct.findById.mockResolvedValue(mockProductData);
      mockUserProductTracking.findUserTracking.mockResolvedValue(null);
      mockUserProductTracking.mockImplementation(() => mockTrackingData as any);
      mockProduct.findByIdAndUpdate.mockResolvedValue(mockProductData);

      const requestBody = {
        productId: mockProductId,
        alertSettings: {
          priceDecrease: true,
          priceIncrease: false,
          backInStock: true,
          frequency: 'immediate'
        },
        trackingReason: 'purchase_intent'
      };

      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Product tracking started successfully');
      expect(mockUserData.incrementUsage).toHaveBeenCalledWith('products');
    });

    test('should return 404 for non-existent product', async () => {
      mockUser.findOne.mockResolvedValue(mockUserData);
      mockProduct.findById.mockResolvedValue(null);

      const requestBody = { productId: 'non_existent_id' };
      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Product not found');
    });

    test('should return 409 for already tracked product', async () => {
      mockUser.findOne.mockResolvedValue(mockUserData);
      mockProduct.findById.mockResolvedValue(mockProductData);
      mockUserProductTracking.findUserTracking.mockResolvedValue({ ...mockTrackingData, deletedAt: undefined });

      const requestBody = { productId: mockProductId };
      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Product already being tracked');
    });

    test('should return 402 for subscription limit reached', async () => {
      const limitedUser = {
        ...mockUserData,
        canTrackMoreProducts: jest.fn().mockReturnValue(false)
      };
      mockUser.findOne.mockResolvedValue(limitedUser);

      const requestBody = { productId: mockProductId };
      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toContain('Product limit reached');
    });

    test('should validate input data', async () => {
      const invalidRequestBody = {
        productId: '', // Invalid: empty string
        alertSettings: {
          threshold: -10 // Invalid: negative number
        }
      };

      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody)
      });

      const response = await POST(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
    });
  });

  describe('PUT /api/products/user/[userId]', () => {
    test('should successfully bulk update tracked products', async () => {
      const updateResult = {
        modifiedCount: 2,
        matchedCount: 2
      };
      mockUserProductTracking.updateMany.mockResolvedValue(updateResult);

      const requestBody = {
        productIds: [mockProductId, 'another_product_id'],
        updates: {
          alertSettings: {
            priceDecrease: false,
            priceIncrease: true
          },
          isActive: true
        }
      };

      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.modifiedCount).toBe(2);
      expect(data.message).toContain('Updated 2 product trackings');
    });

    test('should return 400 for empty product IDs array', async () => {
      const requestBody = {
        productIds: [],
        updates: { isActive: false }
      };

      const request = new NextRequest('http://localhost/api/products/user/user_123', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Product IDs array is required');
    });
  });

  describe('DELETE /api/products/user/[userId]', () => {
    test('should successfully remove tracked products (soft delete)', async () => {
      const deleteResult = { modifiedCount: 2 };
      mockUserProductTracking.updateMany.mockResolvedValue(deleteResult);
      mockUser.findOne.mockResolvedValue(mockUserData);

      const request = new NextRequest(`http://localhost/api/products/user/user_123?productIds=${mockProductId},another_id&softDelete=true`);
      const response = await DELETE(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.removedCount).toBe(2);
      expect(data.data.softDelete).toBe(true);
    });

    test('should successfully remove tracked products (hard delete)', async () => {
      const deleteResult = { deletedCount: 1 };
      mockUserProductTracking.deleteMany.mockResolvedValue(deleteResult);
      mockUser.findOne.mockResolvedValue(mockUserData);

      const request = new NextRequest(`http://localhost/api/products/user/user_123?productIds=${mockProductId}`);
      const response = await DELETE(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.removedCount).toBe(1);
      expect(data.data.softDelete).toBe(false);
    });

    test('should return 400 for missing product IDs', async () => {
      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await DELETE(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Product IDs are required');
    });

    test('should update user usage count after deletion', async () => {
      const deleteResult = { modifiedCount: 1 };
      mockUserProductTracking.updateMany.mockResolvedValue(deleteResult);
      mockUser.findOne.mockResolvedValue(mockUserData);

      const request = new NextRequest(`http://localhost/api/products/user/user_123?productIds=${mockProductId}&softDelete=true`);
      await DELETE(request, { params: { userId: mockUserId } });

      expect(mockUserData.save).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      mockConnectToDB.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    test('should handle unexpected errors gracefully', async () => {
      mockUserProductTracking.find.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Performance and Analytics', () => {
    test('should calculate price change percentage correctly', async () => {
      const productWithPriceChange = {
        ...mockProductData,
        currentPrice: 80,
        originalPrice: 100
      };

      mockUserProductTracking.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  { ...mockTrackingData, productId: productWithPriceChange }
                ])
              })
            })
          })
        })
      } as any);

      mockUserProductTracking.countDocuments.mockResolvedValue(1);

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(data.data.products[0].priceChangePercentage).toBe(-20); // (80-100)/100 * 100
    });

    test('should include summary analytics in response', async () => {
      mockUserProductTracking.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  { ...mockTrackingData, productId: mockProductData, isActive: true },
                  { ...mockTrackingData, productId: mockProductData, isActive: false }
                ])
              })
            })
          })
        })
      } as any);

      mockUserProductTracking.countDocuments.mockResolvedValue(2);

      const request = new NextRequest('http://localhost/api/products/user/user_123');
      const response = await GET(request, { params: { userId: mockUserId } });
      const data = await response.json();

      expect(data.data.summary).toMatchObject({
        totalTracked: 2,
        activeTracked: 1,
        averagePriceChange: expect.any(Number)
      });
    });
  });
});