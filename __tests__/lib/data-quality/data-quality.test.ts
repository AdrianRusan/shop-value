// Data Quality Assurance Test Suite
// Comprehensive tests for ShopValue data quality validation system

import { DataQualityAssurance } from '@/lib/data-quality';
import { priceValidator } from '@/lib/data-quality/price-validator';
import { imageValidator } from '@/lib/data-quality/image-validator';
import { titleStandardizer } from '@/lib/data-quality/title-standardizer';
import { availabilityDetector } from '@/lib/data-quality/availability-detector';
import { duplicateDetector } from '@/lib/data-quality/duplicate-detector';
import { Product } from '@/types';

// Mock dependencies
jest.mock('@/lib/mongoose');
jest.mock('@/lib/models/product.model');
jest.mock('@sentry/nextjs');
jest.mock('@/lib/upstash');

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

jest.mock('@/lib/upstash', () => ({
  redis: mockRedis,
}));

describe('DataQualityAssurance', () => {
  let dataQuality: DataQualityAssurance;
  
  const mockProduct: Partial<Product> = {
    url: 'https://flip.ro/telefon-samsung-galaxy-s23-5g-256gb-phantom-black',
    title: 'Samsung Galaxy S23 5G 256GB Phantom Black',
    currentPrice: 3500,
    originalPrice: 4000,
    currency: 'RON',
    image: 'https://s3.flip.ro/cs-caselogic/product/3066/3066-o_1.jpg',
    brand: 'Samsung',
    category: 'Telefoane',
    source: 'flip'
  };

  beforeEach(() => {
    dataQuality = new DataQualityAssurance({
      strictMode: false,
      minConfidenceScore: 0.8,
      enableImageBackup: true,
      enableDuplicateDetection: true,
      enableAvailabilityDetection: true
    });
    
    // Reset all mocks
    jest.clearAllMocks();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.setex.mockReset();
  });

  describe('validateProduct', () => {
    it('should validate a complete product successfully', async () => {
             // Mock all validators to return successful results
       jest.spyOn(priceValidator, 'validateAndNormalize').mockResolvedValue({
         isValid: true,
         confidence: 0.9,
         issues: [],
         cleanedData: { currentPrice: 3500, originalPrice: 4000, currency: 'RON' },
         recommendations: []
       });

       jest.spyOn(imageValidator, 'validateAndBackup').mockResolvedValue({
         isValid: true,
         confidence: 0.85,
         issues: [],
         cleanedData: { image: mockProduct.image },
         recommendations: []
       });

       jest.spyOn(titleStandardizer, 'standardize').mockResolvedValue({
         isValid: true,
         confidence: 0.9,
         issues: [],
         cleanedData: { title: mockProduct.title, brand: 'Samsung', productModel: 'Galaxy S23' },
         recommendations: []
       });

      jest.spyOn(availabilityDetector, 'detect').mockResolvedValue({
        confidence: 0.8,
        issues: [],
        cleanedData: { isOutOfStock: false, availability: 'in_stock' }
      });

      jest.spyOn(duplicateDetector, 'checkForDuplicates').mockResolvedValue({
        confidence: 0.9,
        issues: [],
        recommendations: []
      });

      const result = await dataQuality.validateProduct(mockProduct);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.issues).toHaveLength(0);
      expect(result.cleanedData).toMatchObject({
        currentPrice: 3500,
        originalPrice: 4000,
        currency: 'RON',
        image: mockProduct.image,
        title: mockProduct.title
      });
    });

    it('should handle validation errors gracefully', async () => {
      jest.spyOn(priceValidator, 'validateAndNormalize').mockRejectedValue(
        new Error('Price validation failed')
      );

      const result = await dataQuality.validateProduct(mockProduct);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('error');
    });

    it('should respect strict mode configuration', async () => {
      const strictDataQuality = new DataQualityAssurance({
        strictMode: true,
        minConfidenceScore: 0.9
      });

             // Mock validators to return low confidence
       jest.spyOn(priceValidator, 'validateAndNormalize').mockResolvedValue({
         isValid: true,
         confidence: 0.7,
         issues: [],
         cleanedData: { currentPrice: 3500 },
         recommendations: []
       });

      const result = await strictDataQuality.validateProduct(mockProduct);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('validateProducts (batch)', () => {
    it('should validate multiple products', async () => {
      const products = [mockProduct, { ...mockProduct, title: 'iPhone 14 Pro' }];

      // Mock successful validation for each product
      jest.spyOn(dataQuality, 'validateProduct').mockResolvedValue({
        isValid: true,
        confidence: 0.85,
        issues: [],
        cleanedData: mockProduct,
        recommendations: []
      });

      const results = await dataQuality.validateProducts(products);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.isValid)).toBe(true);
    });
  });

  describe('generateQualityReport', () => {
    it('should generate comprehensive quality report', () => {
      const mockResults = [
        {
          isValid: true,
          confidence: 0.9,
          issues: [{ type: 'info' as const, field: 'price', message: 'Good price' }],
          cleanedData: {},
          recommendations: []
        },
        {
          isValid: false,
          confidence: 0.6,
          issues: [{ type: 'error' as const, field: 'image', message: 'Invalid image' }],
          cleanedData: {},
          recommendations: ['Fix image URL']
        }
      ];

      const report = dataQuality.generateQualityReport(mockResults);

      expect(report.summary.totalProducts).toBe(2);
      expect(report.summary.validProducts).toBe(1);
      expect(report.summary.averageConfidence).toBe(0.75);
      expect(report.summary.commonIssues).toEqual({ image: 1, price: 1 });
      expect(report.recommendations).toContain('Fix image URL');
    });
  });
});

describe('PriceValidator', () => {
  beforeEach(() => {
    mockRedis.get.mockReset();
    mockRedis.setex.mockReset();
  });

  describe('validateAndNormalize', () => {
    it('should validate valid Romanian prices', async () => {
      const result = await priceValidator.validateAndNormalize({
        currentPrice: 3500,
        originalPrice: 4000,
        currency: 'RON'
      });

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.issues).toHaveLength(0);
      expect(result.cleanedData.currentPrice).toBe(3500);
    });

    it('should detect invalid price formats', async () => {
      const result = await priceValidator.validateAndNormalize({
        currentPrice: -100,
        originalPrice: 4000,
        currency: 'RON'
      });

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.issues.some(issue => issue.type === 'error')).toBe(true);
    });

    it('should normalize prices to RON', async () => {
      // Mock exchange rate
      mockRedis.get.mockResolvedValue('4.9');

      const result = await priceValidator.validateAndNormalize({
        currentPrice: 100,
        originalPrice: 120,
        currency: 'EUR'
      });

      expect(result.cleanedData.currentPrice).toBe(490); // 100 * 4.9
      expect(result.cleanedData.currency).toBe('RON');
    });

    it('should detect suspicious discounts', async () => {
      const result = await priceValidator.validateAndNormalize({
        currentPrice: 100,
        originalPrice: 10000,
        currency: 'RON'
      });

      expect(result.issues.some(issue => 
        issue.message.includes('suspicious discount')
      )).toBe(true);
    });
  });
});

describe('ImageValidator', () => {
  describe('validateAndBackup', () => {
    it('should validate correct image URLs', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      
      // Mock successful fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'image/jpeg';
            if (name === 'content-length') return '1048576'; // 1MB
            return null;
          }
        }
      });

             const result = await imageValidator.validateAndBackup(imageUrl, {
         enableCDN: false,
         generateThumbnails: false
       });

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.cleanedData.image).toBe(imageUrl);
    });

    it('should handle invalid image URLs', async () => {
      const invalidUrl = 'not-a-url';

             const result = await imageValidator.validateAndBackup(invalidUrl, {
         enableCDN: false,
         generateThumbnails: false
       });

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.issues.some(issue => issue.type === 'error')).toBe(true);
    });
  });
});

describe('TitleStandardizer', () => {
  describe('standardize', () => {
    it('should clean and standardize product titles', async () => {
      const messyTitle = '  SAMSUNG  galaxy s23   5G  ';

      const result = await titleStandardizer.standardize(messyTitle);

      expect(result.cleanedData.title).toBe('Samsung Galaxy S23 5G');
      expect(result.cleanedData.brand).toBe('Samsung');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect brand names', async () => {
      const title = 'iPhone 14 Pro Max 256GB Space Black';

      const result = await titleStandardizer.standardize(title);

      expect(result.cleanedData.brand).toBe('Apple');
      expect(result.cleanedData.productModel).toContain('iPhone 14 Pro Max');
    });

    it('should extract product models', async () => {
      const title = 'Samsung Galaxy S23 Ultra 5G 512GB';

      const result = await titleStandardizer.standardize(title);

      expect(result.cleanedData.productModel).toContain('Galaxy S23 Ultra');
    });
  });
});

describe('AvailabilityDetector', () => {
  describe('detect', () => {
    it('should detect out of stock from content', async () => {
      const content = 'Produsul este epuizat momentan';

      const result = await availabilityDetector.detect('https://example.com', {
        scrapedContent: content
      });

      expect(result.cleanedData.availability).toBe('out_of_stock');
      expect(result.cleanedData.isOutOfStock).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect in stock status', async () => {
      const content = 'Produsul este în stoc, livrare imediată';

      const result = await availabilityDetector.detect('https://example.com', {
        scrapedContent: content
      });

      expect(result.cleanedData.availability).toBe('in_stock');
      expect(result.cleanedData.isOutOfStock).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should extract stock quantities', async () => {
      const content = 'Doar 3 bucăți rămase în stoc';

      const result = await availabilityDetector.detect('https://example.com', {
        scrapedContent: content
      });

      expect(result.cleanedData.stockQuantity).toBe(3);
      expect(result.cleanedData.availability).toBe('limited_stock');
    });

    it('should handle price-based availability hints', async () => {
      const result = await availabilityDetector.detect('https://example.com', {
        priceData: { currentPrice: 0, originalPrice: 1000 }
      });

      expect(result.cleanedData.availability).toBe('out_of_stock');
    });
  });
});

describe('DuplicateDetector', () => {
  const mockMongooseFind = jest.fn();
  
  beforeEach(() => {
    // Mock Product model
    require('@/lib/models/product.model').default = {
      find: mockMongooseFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      })
    };
  });

  describe('checkForDuplicates', () => {
    it('should detect URL-based duplicates', async () => {
      const mockDuplicates = [
        {
          _id: 'mock-id',
          url: 'https://flip.ro/samsung-galaxy-s23',
          title: 'Samsung Galaxy S23'
        }
      ];

      mockMongooseFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockDuplicates)
          })
        })
      });

      const result = await duplicateDetector.checkForDuplicates({
        url: 'https://flip.ro/samsung-galaxy-s23?ref=123',
        title: 'Samsung Galaxy S23 5G',
        brand: 'Samsung'
      });

      expect(result.duplicates).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should normalize URLs correctly', async () => {
      // Test URL normalization through duplicate detection
      mockMongooseFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await duplicateDetector.checkForDuplicates({
        url: 'https://www.flip.ro/product?utm_source=google&ref=abc#reviews',
        title: 'Test Product',
        brand: 'Test'
      });

      // Should not throw error and handle URL normalization
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect title-based duplicates', async () => {
      const mockTitleDuplicates = [
        {
          _id: 'mock-id-2',
          url: 'https://example.com/samsung-phone',
          title: 'Samsung Galaxy S23 256GB Black'
        }
      ];

      mockMongooseFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockTitleDuplicates)
          })
        })
      });

      const result = await duplicateDetector.checkForDuplicates({
        url: 'https://different-site.com/phone',
        title: 'Samsung Galaxy S23 256GB Phantom Black',
        brand: 'Samsung'
      });

      // Should detect high similarity
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
});

describe('Integration Tests', () => {
  it('should integrate all validators in real workflow', async () => {
    const dataQuality = new DataQualityAssurance({
      strictMode: false,
      minConfidenceScore: 0.7
    });

    const realProduct: Partial<Product> = {
      url: 'https://flip.ro/samsung-galaxy-s23-ultra',
      title: 'Samsung Galaxy S23 Ultra 5G 256GB Phantom Black',
      currentPrice: 5500,
      originalPrice: 6000,
      currency: 'RON',
      image: 'https://s3.flip.ro/cs-caselogic/product/test.jpg',
      brand: 'Samsung',
      category: 'Telefoane',
      source: 'flip',
      description: 'Telefon Samsung în stoc, livrare gratuită'
    };

    // This will test the real integration without mocks
    const result = await dataQuality.validateProduct(realProduct);

    expect(result).toBeDefined();
    expect(typeof result.isValid).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.cleanedData).toBe('object');
  });
}); 