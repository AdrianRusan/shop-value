import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductCard from '@/components/ProductCard';
import { mockProduct, mockOutOfStockProduct, createMockProduct } from '@/tests/utils/test-helpers';

describe('ProductCard Component', () => {
  describe('Rendering with in-stock product', () => {
    it('renders product information correctly', () => {
      render(<ProductCard product={mockProduct} />);
      
      expect(screen.getByText(mockProduct.title)).toBeInTheDocument();
      expect(screen.getByText(mockProduct.category)).toBeInTheDocument();
      expect(screen.getByText(`${mockProduct.currentPrice}`)).toBeInTheDocument();
      expect(screen.getAllByText(mockProduct.currency)).toHaveLength(2); // Both original and current price show currency
    });

    it('displays product image with correct attributes', () => {
      render(<ProductCard product={mockProduct} />);
      
      const productImage = screen.getByAltText(mockProduct.title);
      expect(productImage).toBeInTheDocument();
      expect(productImage).toHaveAttribute('src', expect.stringContaining(mockProduct.image));
      expect(productImage).toHaveAttribute('width', '200');
      expect(productImage).toHaveAttribute('height', '200');
    });

    it('shows source logo for flip products', () => {
      render(<ProductCard product={mockProduct} />);
      
      const sourceImage = screen.getByAltText(mockProduct.source);
      expect(sourceImage).toBeInTheDocument();
      expect(sourceImage).toHaveAttribute('width', '50');
      expect(sourceImage).toHaveAttribute('height', '50');
    });

    it('creates correct product link', () => {
      render(<ProductCard product={mockProduct} />);
      
      const link = screen.getByRole('link');
      const expectedHref = `/produse/${mockProduct.brand}/${mockProduct.productModel?.replace(/ /g, '-')}/${mockProduct._id}`;
      
      expect(link).toHaveAttribute('href', expectedHref);
    });
  });

  describe('Rendering with out-of-stock product', () => {
    it('displays out of stock message', () => {
      render(<ProductCard product={mockOutOfStockProduct} />);
      
      expect(screen.getByText('Stoc Epuizat')).toBeInTheDocument();
      expect(screen.queryByText(`${mockOutOfStockProduct.currentPrice}`)).not.toBeInTheDocument();
    });

    it('does not show price information when out of stock', () => {
      render(<ProductCard product={mockOutOfStockProduct} />);
      
      expect(screen.queryByText('RON')).not.toBeInTheDocument();
      expect(screen.queryByText(mockOutOfStockProduct.currentPrice.toString())).not.toBeInTheDocument();
    });
  });

  describe('Price display variations', () => {
    it('shows both original and current price when discount exists', () => {
      const productWithDiscount = createMockProduct({
        currentPrice: 2500,
        originalPrice: 3000,
      });
      
      render(<ProductCard product={productWithDiscount} />);
      
      expect(screen.getByText('2500')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
      
      // Check that original price has line-through styling
      const originalPriceElement = screen.getByText('3000').closest('p');
      expect(originalPriceElement).toHaveClass('line-through');
    });

    it('hides original price when no discount', () => {
      const productNoDiscount = createMockProduct({
        currentPrice: 2500,
        originalPrice: 0,
      });
      
      render(<ProductCard product={productNoDiscount} />);
      
      expect(screen.getByText('2500')).toBeInTheDocument();
      
      // Check that original price element is hidden
      const originalPriceElement = screen.getByText('0').closest('p');
      expect(originalPriceElement).toHaveClass('hidden');
    });

    it('shows only current price when originalPrice is same as currentPrice', () => {
      const productSamePrice = createMockProduct({
        currentPrice: 2500,
        originalPrice: 2500,
      });
      
      render(<ProductCard product={productSamePrice} />);
      
      expect(screen.getAllByText('2500')).toHaveLength(2); // Both prices displayed
    });
  });

  describe('Product model handling', () => {
    it('handles missing product model gracefully', () => {
      const productNoModel = createMockProduct({
        productModel: undefined as any,
      });
      
      render(<ProductCard product={productNoModel} />);
      
      const link = screen.getByRole('link');
      const expectedHref = `/produse/${productNoModel.brand}/unknown/${productNoModel._id}`;
      
      expect(link).toHaveAttribute('href', expectedHref);
    });

    it('replaces spaces with hyphens in product model URL', () => {
      const productWithSpaces = createMockProduct({
        productModel: 'iPhone 15 Pro Max',
      });
      
      render(<ProductCard product={productWithSpaces} />);
      
      const link = screen.getByRole('link');
      const expectedHref = `/produse/${productWithSpaces.brand}/iPhone-15-Pro-Max/${productWithSpaces._id}`;
      
      expect(link).toHaveAttribute('href', expectedHref);
    });
  });

  describe('Image fallback handling', () => {
    it('uses flip logo as fallback when no product image', () => {
      const productNoImage = createMockProduct({
        image: '',
      });
      
      render(<ProductCard product={productNoImage} />);
      
      const productImage = screen.getByAltText(productNoImage.title);
      expect(productImage).toHaveAttribute('src', expect.stringContaining('/assets/images/flip.jpg'));
    });

    it('uses product image when available', () => {
      render(<ProductCard product={mockProduct} />);
      
      const productImage = screen.getByAltText(mockProduct.title);
      expect(productImage).toHaveAttribute('src', expect.stringContaining(mockProduct.image));
    });
  });

  describe('Styling and layout', () => {
    it('applies correct CSS classes', () => {
      render(<ProductCard product={mockProduct} />);
      
      const cardContainer = screen.getByRole('link').closest('div');
      expect(cardContainer).toHaveClass('mx-0');
      
      const link = screen.getByRole('link');
      expect(link).toHaveClass('product-card', 'min-h-[490px]');
    });

    it('applies correct image container styling', () => {
      render(<ProductCard product={mockProduct} />);
      
      const imageContainer = screen.getByAltText(mockProduct.title).closest('div');
      expect(imageContainer).toHaveClass('product-card_img-container', 'border', 'border-slate-200', 'dark:bg-white');
    });

    it('applies correct title styling', () => {
      render(<ProductCard product={mockProduct} />);
      
      const titleElement = screen.getByText(mockProduct.title);
      expect(titleElement).toHaveClass('product-title');
    });
  });

  describe('Accessibility', () => {
    it('has proper alt text for images', () => {
      render(<ProductCard product={mockProduct} />);
      
      const productImage = screen.getByAltText(mockProduct.title);
      expect(productImage).toBeInTheDocument();
      
      const sourceImage = screen.getByAltText(mockProduct.source);
      expect(sourceImage).toBeInTheDocument();
    });

    it('has proper link role and accessibility', () => {
      render(<ProductCard product={mockProduct} />);
      
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href');
    });
  });

  describe('Edge cases', () => {
    it('handles very long product titles', () => {
      const productLongTitle = createMockProduct({
        title: 'A'.repeat(200),
      });
      
      render(<ProductCard product={productLongTitle} />);
      
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    it('handles zero prices', () => {
      const productZeroPrice = createMockProduct({
        currentPrice: 0,
        originalPrice: 0,
      });
      
      render(<ProductCard product={productZeroPrice} />);
      
      expect(screen.getAllByText('0')).toHaveLength(2); // Both original and current price show 0
    });

    it('handles very high prices', () => {
      const productHighPrice = createMockProduct({
        currentPrice: 999999,
        originalPrice: 1000000,
      });
      
      render(<ProductCard product={productHighPrice} />);
      
      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText('1000000')).toBeInTheDocument();
    });

    it('handles special characters in category', () => {
      const productSpecialCategory = createMockProduct({
        category: 'Telefoane & Accesorii > Smartphone-uri',
      });
      
      render(<ProductCard product={productSpecialCategory} />);
      
      expect(screen.getByText('Telefoane & Accesorii > Smartphone-uri')).toBeInTheDocument();
    });

    it('handles non-flip source', () => {
      const productOtherSource = createMockProduct({
        source: 'emag',
      });
      
      render(<ProductCard product={productOtherSource} />);
      
      // Should not display flip logo for non-flip sources
      expect(screen.queryByAltText('emag')).not.toBeInTheDocument();
    });
  });
});