// Data Quality Assurance System for ShopValue
// Comprehensive data validation, normalization, and quality checking

import { priceValidator } from './price-validator';
import { imageValidator } from './image-validator';
import { titleStandardizer } from './title-standardizer';
import { availabilityDetector } from './availability-detector';
import { duplicateDetector } from './duplicate-detector';
import { Product } from '@/types';
import * as Sentry from '@sentry/nextjs';

export interface DataQualityResult {
  isValid: boolean;
  confidence: number; // 0-1 score
  issues: DataQualityIssue[];
  cleanedData: Partial<Product>;
  recommendations: string[];
}

export interface DataQualityIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  originalValue?: any;
  suggestedValue?: any;
}

export interface DataQualityConfig {
  strictMode: boolean;
  minConfidenceScore: number;
  enableImageBackup: boolean;
  enableDuplicateDetection: boolean;
  enableAvailabilityDetection: boolean;
}

export class DataQualityAssurance {
  private config: DataQualityConfig;

  constructor(config: Partial<DataQualityConfig> = {}) {
    this.config = {
      strictMode: false,
      minConfidenceScore: 0.8,
      enableImageBackup: true,
      enableDuplicateDetection: true,
      enableAvailabilityDetection: true,
      ...config
    };
  }

  /**
   * Main entry point for data quality validation
   */
  async validateProduct(productData: Partial<Product>): Promise<DataQualityResult> {
    try {
      const issues: DataQualityIssue[] = [];
      const cleanedData: Partial<Product> = { ...productData };
      const recommendations: string[] = [];
      let totalConfidence = 0;
      let validationCount = 0;

      // 1. Price Validation and Currency Normalization
      if (productData.currentPrice !== undefined || productData.originalPrice !== undefined) {
        const priceResult = await priceValidator.validateAndNormalize({
          currentPrice: productData.currentPrice,
          originalPrice: productData.originalPrice,
          currency: productData.currency || 'RON'
        });

        issues.push(...priceResult.issues);
        Object.assign(cleanedData, priceResult.cleanedData);
        totalConfidence += priceResult.confidence;
        validationCount++;

        if (priceResult.recommendations.length > 0) {
          recommendations.push(...priceResult.recommendations);
        }
      }

      // 2. Image URL Validation with CDN Backup
      if (productData.image && this.config.enableImageBackup) {
        const imageResult = await imageValidator.validateAndBackup(productData.image, {
          enableCDN: this.config.enableImageBackup,
          generateThumbnails: true
        });

        issues.push(...imageResult.issues);
        if (imageResult.cleanedData.image) {
          cleanedData.image = imageResult.cleanedData.image;
        }
        totalConfidence += imageResult.confidence;
        validationCount++;
      }

      // 3. Product Title Standardization
      if (productData.title) {
        const titleResult = await titleStandardizer.standardize(productData.title, {
          brand: productData.brand,
          category: productData.category,
          source: productData.source
        });

        issues.push(...titleResult.issues);
        Object.assign(cleanedData, titleResult.cleanedData);
        totalConfidence += titleResult.confidence;
        validationCount++;

        if (titleResult.recommendations.length > 0) {
          recommendations.push(...titleResult.recommendations);
        }
      }

      // 4. Availability Status Detection
      if (this.config.enableAvailabilityDetection && productData.url) {
        const availabilityResult = await availabilityDetector.detect(productData.url, {
          scrapedContent: productData.description,
          priceData: {
            currentPrice: cleanedData.currentPrice || productData.currentPrice,
            originalPrice: cleanedData.originalPrice || productData.originalPrice
          }
        });

        issues.push(...availabilityResult.issues);
        Object.assign(cleanedData, availabilityResult.cleanedData);
        totalConfidence += availabilityResult.confidence;
        validationCount++;
      }

      // 5. Duplicate Detection
      if (this.config.enableDuplicateDetection && productData.url && productData.title) {
        const duplicateResult = await duplicateDetector.checkForDuplicates({
          url: productData.url,
          title: cleanedData.title || productData.title,
          brand: cleanedData.brand || productData.brand,
          productModel: cleanedData.productModel || productData.productModel
        });

        issues.push(...duplicateResult.issues);
        if (duplicateResult.recommendations.length > 0) {
          recommendations.push(...duplicateResult.recommendations);
        }
        totalConfidence += duplicateResult.confidence;
        validationCount++;
      }

      // Calculate overall confidence score
      const overallConfidence = validationCount > 0 ? totalConfidence / validationCount : 0;

      // Determine if data is valid based on confidence and issues
      const hasErrors = issues.some(issue => issue.type === 'error');
      const meetsConfidenceThreshold = overallConfidence >= this.config.minConfidenceScore;
      const isValid = !hasErrors && (!this.config.strictMode || meetsConfidenceThreshold);

      return {
        isValid,
        confidence: overallConfidence,
        issues,
        cleanedData,
        recommendations
      };

    } catch (error) {
      Sentry.captureException(error);
      console.error('Data quality validation failed:', error);

      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'error',
          field: 'system',
          message: `Data quality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        cleanedData: productData,
        recommendations: ['Consider reviewing the data quality validation system configuration']
      };
    }
  }

  /**
   * Batch validate multiple products
   */
  async validateProducts(products: Partial<Product>[]): Promise<DataQualityResult[]> {
    const results: DataQualityResult[] = [];

    for (const product of products) {
      try {
        const result = await this.validateProduct(product);
        results.push(result);
      } catch (error) {
        Sentry.captureException(error);
        results.push({
          isValid: false,
          confidence: 0,
          issues: [{
            type: 'error',
            field: 'system',
            message: `Batch validation failed for product: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          cleanedData: product,
          recommendations: []
        });
      }
    }

    return results;
  }

  /**
   * Generate data quality report
   */
  generateQualityReport(results: DataQualityResult[]): {
    summary: {
      totalProducts: number;
      validProducts: number;
      averageConfidence: number;
      commonIssues: Record<string, number>;
    };
    recommendations: string[];
  } {
    const totalProducts = results.length;
    const validProducts = results.filter(r => r.isValid).length;
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / totalProducts || 0;
    
    const issueCounter: Record<string, number> = {};
    const allRecommendations: string[] = [];

    results.forEach(result => {
      result.issues.forEach(issue => {
        const key = `${issue.field}:${issue.type}`;
        issueCounter[key] = (issueCounter[key] || 0) + 1;
      });
      allRecommendations.push(...result.recommendations);
    });

    // Get unique recommendations
    const recommendations = Array.from(new Set(allRecommendations));

    return {
      summary: {
        totalProducts,
        validProducts,
        averageConfidence,
        commonIssues: issueCounter
      },
      recommendations
    };
  }
}

// Export singleton instance with default configuration
export const dataQualityAssurance = new DataQualityAssurance();

// Export individual validators for direct use
export {
  priceValidator,
  imageValidator,
  titleStandardizer,
  availabilityDetector,
  duplicateDetector
};

 