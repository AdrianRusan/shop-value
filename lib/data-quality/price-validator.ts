// Price Validation and Currency Normalization Service
// Handles price format validation, currency conversion, and price anomaly detection

import { DataQualityIssue } from './index';
import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/upstash';

export interface PriceValidationInput {
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  source?: string;
}

export interface PriceValidationResult {
  isValid: boolean;
  confidence: number;
  issues: DataQualityIssue[];
  cleanedData: {
    currentPrice?: number;
    originalPrice?: number;
    currency?: string;
    discountRate?: number;
    priceStatus?: 'normal' | 'suspicious' | 'error';
  };
  recommendations: string[];
}

// Currency exchange rates cache key
const EXCHANGE_RATES_KEY = 'currency:exchange_rates';
const EXCHANGE_RATES_TTL = 3600; // 1 hour

// Price anomaly detection thresholds
const PRICE_THRESHOLDS = {
  MIN_PRICE: 0.01,
  MAX_PRICE: 1000000,
  MAX_DISCOUNT_PERCENTAGE: 90,
  SUSPICIOUS_DISCOUNT_THRESHOLD: 80,
  PRICE_CHANGE_ALERT_THRESHOLD: 50 // 50% change from historical average
};

// Supported currencies with their regional formats
const CURRENCY_CONFIG = {
  RON: {
    symbol: 'lei',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    pattern: /(\d+)[\.,]?(\d{0,2})\s*(lei|ron)/i
  },
  EUR: {
    symbol: '€',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    pattern: /(\d+)[\.,]?(\d{0,2})\s*[€eur]/i
  },
  USD: {
    symbol: '$',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    pattern: /\$?\s*(\d+)[\.,]?(\d{0,2})/i
  }
};

class PriceValidator {
  /**
   * Parse price from text with multiple format support
   */
  private extractPriceFromText(priceText: string, currency: string = 'RON'): number {
    if (!priceText) return 0;
    
    // Remove all non-numeric characters except dots and commas
    const cleanText = priceText.replace(/[^\d.,]/g, '');
    
    if (!cleanText) return 0;
    
    let price = 0;
    
    try {
      // Pattern 1 & 3: Handle formats with both dots and commas
      if (cleanText.includes('.') && cleanText.includes(',')) {
        const lastDotIndex = cleanText.lastIndexOf('.');
        const lastCommaIndex = cleanText.lastIndexOf(',');
        
        if (lastCommaIndex > lastDotIndex) {
          // European format: 1.234,56 (comma is decimal separator)
          const beforeComma = cleanText.substring(0, lastCommaIndex).replace(/[.,]/g, '');
          const afterComma = cleanText.substring(lastCommaIndex + 1);
          price = parseFloat(`${beforeComma}.${afterComma}`);
        } else {
          // US format: 1,234.56 (dot is decimal separator)
          const beforeDot = cleanText.substring(0, lastDotIndex).replace(/[.,]/g, '');
          const afterDot = cleanText.substring(lastDotIndex + 1);
          price = parseFloat(`${beforeDot}.${afterDot}`);
        }
      }
      // Pattern 2: 1234,56 (Romanian format)
      else if (cleanText.includes(',') && !cleanText.includes('.')) {
        price = parseFloat(cleanText.replace(',', '.'));
      }
      // Pattern 4: 1234.56 (simple decimal)
      else if (cleanText.includes('.') && !cleanText.includes(',')) {
        price = parseFloat(cleanText);
      }
      // Pattern 5: Plain number
      else {
        price = parseFloat(cleanText);
      }
      
      return isNaN(price) ? 0 : Math.round(price * 100) / 100; // Round to 2 decimals
      
    } catch (error) {
      Sentry.captureException(error);
      return 0;
    }
  }

  /**
   * Validate price range and detect anomalies
   */
  private validatePriceRange(price: number): { isValid: boolean; issues: DataQualityIssue[] } {
    const issues: DataQualityIssue[] = [];
    
    if (price < PRICE_THRESHOLDS.MIN_PRICE) {
      issues.push({
        type: 'error',
        field: 'price',
        message: `Price ${price} is below minimum threshold (${PRICE_THRESHOLDS.MIN_PRICE})`,
        originalValue: price,
        suggestedValue: PRICE_THRESHOLDS.MIN_PRICE
      });
      return { isValid: false, issues };
    }
    
    if (price > PRICE_THRESHOLDS.MAX_PRICE) {
      issues.push({
        type: 'warning',
        field: 'price',
        message: `Price ${price} is very high, please verify`,
        originalValue: price
      });
    }
    
    return { isValid: true, issues };
  }

  /**
   * Validate discount percentage
   */
  private validateDiscount(currentPrice: number, originalPrice: number): { 
    isValid: boolean; 
    issues: DataQualityIssue[];
    discountRate: number;
    isSuspicious: boolean;
  } {
    const issues: DataQualityIssue[] = [];
    
    if (currentPrice > originalPrice) {
      issues.push({
        type: 'warning',
        field: 'discount',
        message: 'Current price is higher than original price',
        originalValue: { currentPrice, originalPrice }
      });
      return { isValid: true, issues, discountRate: 0, isSuspicious: false };
    }
    
    const discountRate = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    
    if (discountRate > PRICE_THRESHOLDS.MAX_DISCOUNT_PERCENTAGE) {
      issues.push({
        type: 'error',
        field: 'discount',
        message: `Discount rate ${discountRate}% exceeds maximum allowed (${PRICE_THRESHOLDS.MAX_DISCOUNT_PERCENTAGE}%)`,
        originalValue: discountRate,
        suggestedValue: PRICE_THRESHOLDS.MAX_DISCOUNT_PERCENTAGE
      });
      return { isValid: false, issues, discountRate, isSuspicious: true };
    }
    
    const isSuspicious = discountRate > PRICE_THRESHOLDS.SUSPICIOUS_DISCOUNT_THRESHOLD;
    if (isSuspicious) {
      issues.push({
        type: 'warning',
        field: 'discount',
        message: `High discount rate ${discountRate}% may indicate data quality issues`,
        originalValue: discountRate
      });
    }
    
    return { isValid: true, issues, discountRate, isSuspicious };
  }

  /**
   * Normalize currency format
   */
  private normalizeCurrency(currency?: string): string {
    if (!currency) return 'RON';
    
    const normalized = currency.toUpperCase().trim();
    
    // Handle common variations
    switch (normalized) {
      case 'LEI':
      case 'ROMANIAN LEI':
        return 'RON';
      case 'EURO':
      case 'EUROS':
        return 'EUR';
      case 'DOLLAR':
      case 'DOLLARS':
      case 'US DOLLAR':
        return 'USD';
      default:
        return Object.keys(CURRENCY_CONFIG).includes(normalized) ? normalized : 'RON';
    }
  }

  /**
   * Get currency exchange rate (cached)
   */
  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;
    
    try {
      const cacheKey = `${EXCHANGE_RATES_KEY}:${fromCurrency}_${toCurrency}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return parseFloat(cached.toString());
      }
      
      // For now, return mock rates - in production, integrate with exchange rate API
      const mockRates: Record<string, Record<string, number>> = {
        RON: { EUR: 0.20, USD: 0.22 },
        EUR: { RON: 5.0, USD: 1.1 },
        USD: { RON: 4.55, EUR: 0.91 }
      };
      
      const rate = mockRates[fromCurrency]?.[toCurrency] || 1;
      
      // Cache for 1 hour
      await redis.setex(cacheKey, EXCHANGE_RATES_TTL, rate.toString());
      
      return rate;
      
    } catch (error) {
      Sentry.captureException(error);
      return 1; // Fallback to 1:1 rate
    }
  }

  /**
   * Main validation and normalization method
   */
  async validateAndNormalize(input: PriceValidationInput): Promise<PriceValidationResult> {
    try {
      const issues: DataQualityIssue[] = [];
      const recommendations: string[] = [];
      const cleanedData: any = {};
      
      // Normalize currency
      const normalizedCurrency = this.normalizeCurrency(input.currency);
      cleanedData.currency = normalizedCurrency;
      
      if (input.currency && input.currency !== normalizedCurrency) {
        issues.push({
          type: 'info',
          field: 'currency',
          message: `Currency normalized from "${input.currency}" to "${normalizedCurrency}"`,
          originalValue: input.currency,
          suggestedValue: normalizedCurrency
        });
      }
      
      let confidence = 1.0;
      
      // Validate current price
      if (input.currentPrice !== undefined) {
        const currentPriceValidation = this.validatePriceRange(input.currentPrice);
        issues.push(...currentPriceValidation.issues);
        
        if (currentPriceValidation.isValid) {
          cleanedData.currentPrice = Math.round(input.currentPrice * 100) / 100;
        } else {
          confidence -= 0.3;
        }
      }
      
      // Validate original price
      if (input.originalPrice !== undefined) {
        const originalPriceValidation = this.validatePriceRange(input.originalPrice);
        issues.push(...originalPriceValidation.issues);
        
        if (originalPriceValidation.isValid) {
          cleanedData.originalPrice = Math.round(input.originalPrice * 100) / 100;
        } else {
          confidence -= 0.3;
        }
      }
      
      // Validate discount if both prices are available
      if (cleanedData.currentPrice && cleanedData.originalPrice) {
        const discountValidation = this.validateDiscount(
          cleanedData.currentPrice,
          cleanedData.originalPrice
        );
        
        issues.push(...discountValidation.issues);
        cleanedData.discountRate = discountValidation.discountRate;
        
        if (discountValidation.isSuspicious) {
          cleanedData.priceStatus = 'suspicious';
          confidence -= 0.2;
          recommendations.push('Verify discount rate with original source');
        } else {
          cleanedData.priceStatus = 'normal';
        }
        
        if (!discountValidation.isValid) {
          confidence -= 0.4;
        }
      }
      
      // Determine overall status
      const hasErrors = issues.some(issue => issue.type === 'error');
      cleanedData.priceStatus = hasErrors ? 'error' : (cleanedData.priceStatus || 'normal');
      
      // Add recommendations based on issues
      if (issues.length > 0) {
        recommendations.push('Review price validation issues and verify data accuracy');
      }
      
      if (confidence < 0.8) {
        recommendations.push('Consider manual review due to low confidence score');
      }
      
      return {
        isValid: !hasErrors,
        confidence: Math.max(0, confidence),
        issues,
        cleanedData,
        recommendations
      };
      
    } catch (error) {
      Sentry.captureException(error);
      console.error('Price validation failed:', error);
      
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'error',
          field: 'system',
          message: `Price validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        cleanedData: {},
        recommendations: ['System error occurred during price validation']
      };
    }
  }

  /**
   * Parse price from text (public method)
   */
  async parsePrice(priceText: string, currency: string = 'RON'): Promise<number> {
    return this.extractPriceFromText(priceText, currency);
  }

  /**
   * Convert price between currencies
   */
  async convertPrice(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return Math.round(amount * rate * 100) / 100;
  }
}

// Export singleton instance
export const priceValidator = new PriceValidator(); 