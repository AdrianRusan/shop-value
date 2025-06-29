import { getProductById, searchProducts, getSimilarProducts } from '@/lib/actions';
import { connectToDB } from '@/lib/mongoose';
import ProductModel from '@/lib/models/product.model';
import { mockProduct, createMockProduct } from '@/tests/utils/test-helpers';

// Mock dependencies
jest.mock('@/lib/mongoose', () => ({
  connectToDB: jest.fn(),
}));

jest.mock('@/lib/scraper', () => ({
  scrapeFlipProduct: jest.fn(),
}));

jest.mock('@/lib/nodemailer', () => ({
  createTransporter: jest.fn(),
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/models/product.model', () => {
  const createChainableMock = (finalResult: any) => ({
    limit: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(finalResult),
      }),
      lean: jest.fn().mockResolvedValue(finalResult),
    }),
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(finalResult),
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(finalResult),
      }),
    }),
    lean: jest.fn().mockResolvedValue(finalResult),
    exec: jest.fn().mockResolvedValue(finalResult),
  });

  return {
    __esModule: true,
    default: {
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      distinct: jest.fn(),
    },
    createChainableMock,
  };
});

const mockConnectToDB = connectToDB as jest.MockedFunction<typeof connectToDB>;
const mockProductModel = ProductModel as jest.Mocked<typeof ProductModel>;

describe('Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDB.mockResolvedValue(null);
  });

  describe('getProductById', () => {
    it('returns product when found', async () => {
      const mockDbProduct = {
        ...mockProduct,
        _id: { toString: () => mockProduct._id },
        lean: jest.fn().mockReturnThis(),
      };
      
      mockProductModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDbProduct),
      } as any);

      const result = await getProductById(mockProduct._id!);

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockProductModel.findOne).toHaveBeenCalledWith({ _id: mockProduct._id });
      expect(result).toEqual({
        ...mockDbProduct,
        _id: mockProduct._id,
      });
    });

    it('returns null when product not found', async () => {
      mockProductModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await getProductById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('returns null when database error occurs', async () => {
      mockProductModel.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      } as any);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getProductById(mockProduct._id!);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('handles invalid ObjectId format', async () => {
      const result = await getProductById('invalid-id');

      // Should still attempt to query (MongoDB handles invalid formats)
      expect(mockConnectToDB).toHaveBeenCalled();
    });
  });

  describe('searchProducts', () => {
    it('returns search results for valid query', async () => {
      // Mock distinct call for brands
      mockProductModel.distinct.mockResolvedValue(['Samsung', 'Apple']);
      
      // Mock the first find call for models (no chaining, returns array directly)
      const modelsResult = [
        { brand: 'Samsung', productModel: 'Galaxy S24' },
        { brand: 'Apple', productModel: 'iPhone 15' },
      ];
      mockProductModel.find.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue(modelsResult),
      } as any);
      
      // Mock the second find call for topSearchedProducts (with chaining)
      const topProductsResult = [
        { productModel: 'Galaxy S24', brand: 'Samsung' },
        { productModel: 'iPhone 15', brand: 'Apple' },
      ];
      mockProductModel.find.mockReturnValueOnce({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(topProductsResult),
          }),
        }),
      } as any);

      const result = await searchProducts('samsung galaxy');

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(result).toHaveProperty('searchTerm', 'samsung galaxy');
      expect(result).toHaveProperty('brands');
      expect(result).toHaveProperty('brandModelObjects');
      expect(result).toHaveProperty('topSearchedProducts');
      expect(result.brandModelObjects).toHaveLength(2);
    });

    it('handles empty search term', async () => {
      mockProductModel.distinct.mockResolvedValue([]);
      mockProductModel.find.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([]),
      } as any);
      mockProductModel.find.mockReturnValueOnce({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await searchProducts('');

      expect(result.searchTerm).toBe('');
      expect(result.brands).toEqual([]);
    });

    it('handles database errors gracefully', async () => {
      mockProductModel.distinct.mockRejectedValue(new Error('Database error'));

      await expect(searchProducts('samsung')).rejects.toThrow('Database error');
    });

    it('processes multi-word search terms correctly', async () => {
      mockProductModel.distinct.mockResolvedValue(['Samsung']);
      const modelsResult = [
        { brand: 'Samsung', productModel: 'Galaxy S24 Ultra' },
      ];
      mockProductModel.find.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue(modelsResult),
      } as any);
      mockProductModel.find.mockReturnValueOnce({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { productModel: 'Galaxy S24 Ultra', brand: 'Samsung' },
            ]),
          }),
        }),
      } as any);

      await searchProducts('samsung galaxy ultra');

      // Verify that multi-word terms are processed correctly
      expect(mockProductModel.distinct).toHaveBeenCalled();
      expect(mockProductModel.find).toHaveBeenCalled();
    });
  });

  describe('getSimilarProducts', () => {
    it('returns similar products from same brand', async () => {
      const similarProducts = [
        createMockProduct({ _id: '1', title: 'Samsung Galaxy S23' }),
        createMockProduct({ _id: '2', title: 'Samsung Galaxy Note' }),
      ];

      mockProductModel.findById.mockResolvedValue(mockProduct);
      mockProductModel.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(similarProducts.map(p => ({
            ...p,
            _id: { toString: () => p._id },
          }))),
        }),
      } as any);

      const result = await getSimilarProducts(mockProduct._id!);

      expect(mockConnectToDB).toHaveBeenCalled();
      expect(mockProductModel.findById).toHaveBeenCalledWith(mockProduct._id);
      expect(mockProductModel.find).toHaveBeenCalledWith({
        _id: { $ne: mockProduct._id },
        brand: mockProduct.brand,
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when product not found', async () => {
      mockProductModel.findById.mockResolvedValue(null);

      const result = await getSimilarProducts('nonexistent-id');

      expect(result).toEqual([]);
    });

    it('returns empty array when no similar products found', async () => {
      mockProductModel.findById.mockResolvedValue(mockProduct);
      mockProductModel.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await getSimilarProducts(mockProduct._id!);

      expect(result).toEqual([]);
    });

    it('excludes the current product from results', async () => {
      mockProductModel.findById.mockResolvedValue(mockProduct);
      mockProductModel.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      } as any);

      await getSimilarProducts(mockProduct._id!);

      expect(mockProductModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $ne: mockProduct._id },
        })
      );
    });

    it('limits results to 4 products', async () => {
      mockProductModel.findById.mockResolvedValue(mockProduct);
      const limitMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      mockProductModel.find.mockReturnValue({
        limit: limitMock,
      } as any);

      await getSimilarProducts(mockProduct._id!);

      expect(limitMock).toHaveBeenCalledWith(4);
    });

    it('handles database errors gracefully', async () => {
      mockProductModel.findById.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getSimilarProducts(mockProduct._id!);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});