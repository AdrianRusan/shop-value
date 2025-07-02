// Availability Status Detection for ShopValue
// Detects product availability with confidence scoring

import { DataQualityIssue } from './index';
import * as Sentry from '@sentry/nextjs';

export interface AvailabilityResult {
  confidence: number;
  issues: DataQualityIssue[];
  cleanedData: {
    isOutOfStock?: boolean;
    availability?: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'unknown';
    availabilityText?: string;
    stockQuantity?: number;
  };
}

export interface AvailabilityDetectionOptions {
  scrapedContent?: string;
  priceData?: {
    currentPrice?: number;
    originalPrice?: number;
  };
  strictMode?: boolean;
}

// Romanian language patterns for availability detection
const AVAILABILITY_PATTERNS = {
  outOfStock: [
    /(?:stoc\s+)?(?:epuizat|indisponibil|nu\s+(?:este\s+)?(?:în\s+)?(?:stoc|disponibil))/i,
    /(?:out\s+of\s+stock|unavailable|sold\s+out)/i,
    /(?:lipsa|lipsește|lipsesc)/i,
    /(?:temporar\s+)?(?:indisponibil|epuizat)/i,
    /(?:nu\s+se\s+află\s+în\s+stoc)/i,
    /(?:produs\s+)?(?:epuizat|indisponibil)/i
  ],
  inStock: [
    /(?:în\s+)?stoc|disponibil|available/i,
    /(?:în\s+stoc|pe\s+stoc)/i,
    /(?:bucăți?\s+)?(?:în\s+)?(?:stoc|magazin)/i,
    /(?:livrare\s+)?(?:imediată?|rapidă?)/i,
    /(?:se\s+poate\s+comanda)/i,
    /(?:ready\s+to\s+ship|in\s+stock)/i
  ],
  limitedStock: [
    /(?:stoc\s+)?limitat/i,
    /(?:ultimele?\s+)?(?:bucăți?|exemplare?)/i,
    /(?:puține?\s+)?(?:bucăți?\s+)?(?:rămase?|disponibile?)/i,
    /(?:limited\s+(?:stock|quantity))/i,
    /(?:doar\s+\d+\s+bucăți?)/i,
    /(?:last\s+\d+\s+(?:items?|pieces?))/i
  ]
};

// Quantity extraction patterns
const QUANTITY_PATTERNS = [
  /(\d+)\s*(?:bucăți?|buc\.?|exemplare?|piese?)/i,
  /(?:doar|only)\s+(\d+)\s*(?:left|remaining|rămase?)/i,
  /(\d+)\s*(?:în\s+stoc|in\s+stock)/i,
  /(?:cantitate|quantity):\s*(\d+)/i
];

class AvailabilityDetector {
  /**
   * Detect product availability status from various data sources
   */
  async detect(
    productUrl: string,
    options: AvailabilityDetectionOptions = {}
  ): Promise<AvailabilityResult> {
    try {
      const issues: DataQualityIssue[] = [];
      let confidence = 0.5; // Base confidence
      let availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'unknown' = 'unknown';
      let isOutOfStock: boolean | undefined;
      let availabilityText: string | undefined;
      let stockQuantity: number | undefined;

      // 1. Analyze scraped content for availability indicators
      if (options.scrapedContent) {
        const contentAnalysis = this.analyzeContent(options.scrapedContent);
        availability = contentAnalysis.status;
        availabilityText = contentAnalysis.text;
        stockQuantity = contentAnalysis.quantity;
        confidence = Math.max(confidence, contentAnalysis.confidence);

        if (contentAnalysis.confidence > 0.8) {
          issues.push({
            type: 'info',
            field: 'availability',
            message: `High confidence availability detection: ${availability}`,
            suggestedValue: availability
          });
        }
      }

      // 2. Analyze price data for availability hints
      if (options.priceData) {
        const priceAnalysis = this.analyzePriceData(options.priceData);
        if (priceAnalysis.confidence > confidence) {
          confidence = priceAnalysis.confidence;
          if (priceAnalysis.suggests === 'out_of_stock') {
            availability = 'out_of_stock';
            issues.push({
              type: 'warning',
              field: 'availability',
              message: 'Price data suggests product may be out of stock'
            });
          }
        }
      }

      // 3. URL-based availability detection
      const urlAnalysis = this.analyzeUrl(productUrl);
      if (urlAnalysis.confidence > 0.3) {
        confidence = Math.max(confidence, urlAnalysis.confidence);
        if (urlAnalysis.suggests) {
          availability = urlAnalysis.suggests;
        }
      }

      // Set isOutOfStock based on availability
      isOutOfStock = availability === 'out_of_stock';

      // 4. Validate confidence threshold
      if (options.strictMode && confidence < 0.7) {
        issues.push({
          type: 'warning',
          field: 'availability',
          message: `Low confidence availability detection (${(confidence * 100).toFixed(1)}%)`,
          suggestedValue: 'unknown'
        });
        availability = 'unknown';
      }

      // 5. Add recommendations based on detection results
      if (availability === 'unknown' && confidence < 0.6) {
        issues.push({
          type: 'info',
          field: 'availability',
          message: 'Consider manual verification of availability status'
        });
      }

      return {
        confidence,
        issues,
        cleanedData: {
          isOutOfStock,
          availability,
          availabilityText,
          stockQuantity
        }
      };

    } catch (error) {
      Sentry.captureException(error);
      console.error('Availability detection failed:', error);

      return {
        confidence: 0,
        issues: [{
          type: 'error',
          field: 'availability',
          message: `Availability detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        cleanedData: {
          availability: 'unknown'
        }
      };
    }
  }

  /**
   * Analyze content text for availability patterns
   */
  private analyzeContent(content: string): {
    status: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'unknown';
    confidence: number;
    text?: string;
    quantity?: number;
  } {
    const normalizedContent = content.toLowerCase().trim();
    let bestMatch: { 
      status: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'unknown'; 
      confidence: number; 
      text: string | undefined 
    } = { status: 'unknown', confidence: 0, text: undefined };

    // Check for out of stock patterns
    for (const pattern of AVAILABILITY_PATTERNS.outOfStock) {
      const match = pattern.exec(normalizedContent);
      if (match) {
        const confidence = 0.9;
        if (confidence > bestMatch.confidence) {
          bestMatch = { 
            status: 'out_of_stock', 
            confidence, 
            text: match[0] 
          };
        }
      }
    }

    // Check for limited stock patterns
    for (const pattern of AVAILABILITY_PATTERNS.limitedStock) {
      const match = pattern.exec(normalizedContent);
      if (match) {
        const confidence = 0.8;
        if (confidence > bestMatch.confidence) {
          bestMatch = { 
            status: 'limited_stock', 
            confidence, 
            text: match[0] 
          };
        }
      }
    }

    // Check for in stock patterns
    for (const pattern of AVAILABILITY_PATTERNS.inStock) {
      const match = pattern.exec(normalizedContent);
      if (match) {
        const confidence = 0.85;
        if (confidence > bestMatch.confidence) {
          bestMatch = { 
            status: 'in_stock', 
            confidence, 
            text: match[0] 
          };
        }
      }
    }

    // Extract quantity information
    let quantity: number | undefined;
    for (const pattern of QUANTITY_PATTERNS) {
      const match = pattern.exec(normalizedContent);
      if (match && match[1]) {
        const parsedQuantity = parseInt(match[1], 10);
        if (!isNaN(parsedQuantity)) {
          quantity = parsedQuantity;
          // Adjust status based on quantity
          if (parsedQuantity === 0) {
            bestMatch = { status: 'out_of_stock', confidence: 0.95, text: match[0] };
          } else if (parsedQuantity <= 5) {
            bestMatch = { status: 'limited_stock', confidence: 0.9, text: match[0] };
          } else {
            bestMatch = { status: 'in_stock', confidence: 0.9, text: match[0] };
          }
          break;
        }
      }
    }

    return {
      status: bestMatch.status,
      confidence: bestMatch.confidence,
      text: bestMatch.text,
      quantity
    };
  }

  /**
   * Analyze price data for availability hints
   */
  private analyzePriceData(priceData: { currentPrice?: number; originalPrice?: number }): {
    confidence: number;
    suggests?: 'out_of_stock' | 'in_stock';
  } {
    // If price is 0 or missing, might suggest out of stock
    if (!priceData.currentPrice || priceData.currentPrice <= 0) {
      return {
        confidence: 0.4,
        suggests: 'out_of_stock'
      };
    }

    // If price is extremely high compared to original, might be out of stock
    if (priceData.originalPrice && priceData.currentPrice > priceData.originalPrice * 3) {
      return {
        confidence: 0.3,
        suggests: 'out_of_stock'
      };
    }

    // Normal price suggests in stock
    return {
      confidence: 0.6,
      suggests: 'in_stock'
    };
  }

  /**
   * Analyze URL for availability hints
   */
  private analyzeUrl(url: string): {
    confidence: number;
    suggests?: 'out_of_stock' | 'in_stock';
  } {
    const normalizedUrl = url.toLowerCase();

    // Check for out of stock indicators in URL
    if (normalizedUrl.includes('out-of-stock') || 
        normalizedUrl.includes('unavailable') ||
        normalizedUrl.includes('epuizat')) {
      return {
        confidence: 0.7,
        suggests: 'out_of_stock'
      };
    }

    // Check for in stock indicators
    if (normalizedUrl.includes('in-stock') || 
        normalizedUrl.includes('available') ||
        normalizedUrl.includes('stoc')) {
      return {
        confidence: 0.6,
        suggests: 'in_stock'
      };
    }

    return { confidence: 0.1 };
  }
}

export const availabilityDetector = new AvailabilityDetector(); 