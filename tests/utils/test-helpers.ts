import { Product } from '@/types';

// Mock product data for testing
export const mockProduct: Product = {
  _id: '507f1f77bcf86cd799439011',
  brand: 'Samsung',
  productModel: 'Galaxy S24',
  url: 'https://flip.ro/telefoane-mobile/samsung-galaxy-s24-128gb-5g-dual-sim-negru-4284872/',
  source: 'flip',
  currency: 'RON',
  image: 'https://flip.ro/image/product.jpg',
  title: 'Samsung Galaxy S24 128GB 5G Dual SIM Negru',
  currentPrice: 3299,
  originalPrice: 3999,
  priceHistory: [
    { price: 3999, date: new Date('2024-01-01') },
    { price: 3599, date: new Date('2024-01-15') },
    { price: 3299, date: new Date('2024-02-01') },
  ],
  highestPrice: 3999,
  lowestPrice: 3299,
  averagePrice: 3632,
  discountRate: 17.5,
  description: 'Latest Samsung Galaxy S24 with advanced features',
  category: 'Telefoane Mobile',
  reviewsCount: 245,
  stars: 4.7,
  isOutOfStock: false,
  availability: 'in_stock',
  trackingStatus: 'active',
  keywords: ['samsung', 'galaxy', 's24', 'telefon', 'mobile'],
};

export const mockOutOfStockProduct: Product = {
  ...mockProduct,
  _id: '507f1f77bcf86cd799439012',
  title: 'iPhone 15 Pro Max 256GB',
  brand: 'Apple',
  productModel: 'iPhone 15 Pro Max',
  isOutOfStock: true,
  availability: 'out_of_stock',
  currentPrice: 0,
  originalPrice: 0,
};

export const mockProductWithoutPrice: Product = {
  ...mockProduct,
  _id: '507f1f77bcf86cd799439013',
  currentPrice: 0,
  originalPrice: 0,
  priceHistory: [],
  highestPrice: 0,
  lowestPrice: 0,
  averagePrice: 0,
};

// Utility function to create mock products with different properties
export const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  ...mockProduct,
  ...overrides,
});

// Mock API responses
export const mockSuccessResponse = {
  ok: true,
  status: 200,
  json: async () => mockProduct,
};

export const mockErrorResponse = {
  ok: false,
  status: 500,
  json: async () => ({ error: 'Internal Server Error' }),
};

// Test utility to wait for async operations
export const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Mock form submission events
export const createMockFormEvent = (formData: Record<string, string>) => ({
  preventDefault: jest.fn(),
  target: {
    elements: Object.keys(formData).reduce((acc, key) => {
      acc[key] = { value: formData[key] };
      return acc;
    }, {} as any),
  },
} as any);

// Valid and invalid URLs for testing
export const validFlipUrls = [
  'https://flip.ro/telefoane-mobile/samsung-galaxy-s24-128gb-5g-dual-sim-negru-4284872/',
  'https://www.flip.ro/laptopuri/macbook-air-13-m2-256gb-midnight/',
  'http://flip.ro/electronice/smart-tv-samsung-55-4k/',
];

export const invalidUrls = [
  'https://emag.ro/product/123',
  'https://flip.ro/category?modelType=list',
  'not-a-url',
  '',
  'https://google.com',
];