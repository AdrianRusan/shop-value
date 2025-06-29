import React from 'react';
import { render, screen } from '@testing-library/react';
import PriceInfoCard from '@/components/PriceInfoCard';

describe('PriceInfoCard Component', () => {
  const mockProps = {
    title: 'Current Price',
    iconSrc: '/assets/icons/price-tag.svg',
    value: 2500,
    currency: 'RON',
    outOfStock: false,
  };

  describe('Rendering', () => {
    it('renders basic price information correctly', () => {
      render(<PriceInfoCard {...mockProps} />);
      
      expect(screen.getByText('Current Price')).toBeInTheDocument();
      expect(screen.getByText('2500 RON')).toBeInTheDocument();
    });

    it('displays icon with correct attributes', () => {
      render(<PriceInfoCard {...mockProps} />);
      
      const icon = screen.getByAltText('Current Price');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('src', expect.stringContaining('/assets/icons/price-tag.svg'));
    });

    it('handles out of stock state', () => {
      render(<PriceInfoCard {...mockProps} outOfStock={true} />);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.queryByText('2500 RON')).not.toBeInTheDocument();
    });
  });

  describe('Date Display', () => {
    it('shows date when provided', () => {
      const dateProps = {
        ...mockProps,
        date: new Date('2024-01-15'),
      };
      
      render(<PriceInfoCard {...dateProps} />);
      
      expect(screen.getByText(/15/)).toBeInTheDocument(); // Date should be displayed
    });

    it('hides date when not provided', () => {
      render(<PriceInfoCard {...mockProps} />);
      
      // Should not show any date-related text
      expect(screen.queryByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)).not.toBeInTheDocument();
    });
  });

  describe('Different Prices Indicator', () => {
    it('shows normal display when differentPrices is true', () => {
      render(<PriceInfoCard {...mockProps} differentPrices={true} />);
      
      expect(screen.getByText('2500 RON')).toBeInTheDocument();
    });

    it('shows appropriate display when differentPrices is false', () => {
      render(<PriceInfoCard {...mockProps} differentPrices={false} />);
      
      expect(screen.getByText('2500 RON')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero price', () => {
      const zeroProps = {
        ...mockProps,
        value: 0,
      };
      
      render(<PriceInfoCard {...zeroProps} />);
      
      expect(screen.getByText('0 RON')).toBeInTheDocument();
    });

    it('handles very high prices', () => {
      const highPriceProps = {
        ...mockProps,
        value: 999999,
      };
      
      render(<PriceInfoCard {...highPriceProps} />);
      
      expect(screen.getByText('999999 RON')).toBeInTheDocument();
    });

    it('handles decimal prices', () => {
      const decimalProps = {
        ...mockProps,
        value: 2999.99,
      };
      
      render(<PriceInfoCard {...decimalProps} />);
      
      expect(screen.getByText('2999.99 RON')).toBeInTheDocument();
    });

    it('handles different currencies', () => {
      const eurProps = {
        ...mockProps,
        value: 500,
        currency: 'EUR',
      };
      
      render(<PriceInfoCard {...eurProps} />);
      
      expect(screen.getByText('500 EUR')).toBeInTheDocument();
    });

    it('handles long titles', () => {
      const longTitleProps = {
        ...mockProps,
        title: 'This is a very long title that might cause layout issues',
      };
      
      render(<PriceInfoCard {...longTitleProps} />);
      
      expect(screen.getByText('This is a very long title that might cause layout issues')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper alt text for icon', () => {
      render(<PriceInfoCard {...mockProps} />);
      
      const icon = screen.getByAltText('Current Price');
      expect(icon).toBeInTheDocument();
    });

    it('maintains semantic structure', () => {
      render(<PriceInfoCard {...mockProps} />);
      
      // Should have proper heading structure
      expect(screen.getByText('Current Price')).toBeInTheDocument();
      expect(screen.getByText('2500 RON')).toBeInTheDocument();
    });
  });
});