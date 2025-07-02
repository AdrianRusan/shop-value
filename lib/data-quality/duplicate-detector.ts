// Duplicate Detection for ShopValue
// Detects duplicate products using URL normalization and fuzzy matching

import { DataQualityIssue } from './index';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import * as Sentry from '@sentry/nextjs';

export interface DuplicateResult {
  confidence: number;
  issues: DataQualityIssue[];
  recommendations: string[];
  duplicates?: {
    id: string;
    url: string;
    title: string;
    similarity: number;
    reason: string;
  }[];
}

export interface DuplicateDetectionInput {
  url: string;
  title: string;
  brand?: string;
  productModel?: string;
}

interface ProductSearchResult {
  _id: any;
  url: string;
  title: string;
  brand?: string;
  productModel?: string;
}

// URL normalization patterns
const URL_NORMALIZATION_PATTERNS = {
  // Remove common tracking parameters
  trackingParams: [
    /[?&]utm_[^&]*/gi,
    /[?&]ref[^&]*/gi,
    /[?&]source[^&]*/gi,
    /[?&]campaign[^&]*/gi,
    /[?&]gclid[^&]*/gi,
    /[?&]fbclid[^&]*/gi
  ],
  // Remove session identifiers
  sessionParams: [
    /[?&]session[^&]*/gi,
    /[?&]sid[^&]*/gi,
    /[?&]PHPSESSID[^&]*/gi
  ],
  // Remove fragments and anchors
  fragments: /#.*/g,
  // Normalize protocol
  protocol: /^https?:\/\//i,
  // Remove www prefix
  www: /^www\./i,
  // Remove trailing slashes
  trailingSlash: /\/+$/g
};

// Text similarity calculation using Levenshtein distance
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const distance = calculateLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

// Fuzzy matching for product titles
function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'for', 'with', 'are', 'was', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'what', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));
}

function calculateKeywordSimilarity(title1: string, title2: string): number {
  const keywords1 = new Set(extractKeywords(title1));
  const keywords2 = new Set(extractKeywords(title2));
  
  const intersection = new Set(Array.from(keywords1).filter(x => keywords2.has(x)));
  const union = new Set([...Array.from(keywords1), ...Array.from(keywords2)]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

class DuplicateDetector {
  /**
   * Check for potential duplicates in the database
   */
  async checkForDuplicates(input: DuplicateDetectionInput): Promise<DuplicateResult> {
    try {
      await connectToDB();
      
      const issues: DataQualityIssue[] = [];
      const recommendations: string[] = [];
      const duplicates: DuplicateResult['duplicates'] = [];
      let overallConfidence = 0.5;

      // 1. Normalize the input URL for comparison
      const normalizedUrl = this.normalizeUrl(input.url);

      // 2. Find potential duplicates using multiple strategies
      const urlDuplicates = await this.findUrlDuplicates(normalizedUrl);
      const titleDuplicates = await this.findTitleDuplicates(input.title);
      const brandModelDuplicates = input.brand && input.productModel 
        ? await this.findBrandModelDuplicates(input.brand, input.productModel)
        : [];

      // 3. Analyze URL-based duplicates
      for (const duplicate of urlDuplicates) {
        const similarity = this.calculateUrlSimilarity(normalizedUrl, this.normalizeUrl(duplicate.url));
        if (similarity > 0.8) {
          duplicates.push({
            id: duplicate._id.toString(),
            url: duplicate.url,
            title: duplicate.title,
            similarity,
            reason: `High URL similarity (${(similarity * 100).toFixed(1)}%)`
          });

          issues.push({
            type: 'warning',
            field: 'url',
            message: `Potential duplicate detected based on URL similarity`,
            originalValue: input.url,
            suggestedValue: duplicate.url
          });
        }
      }

      // 4. Analyze title-based duplicates
      for (const duplicate of titleDuplicates) {
        if (duplicates.some(d => d.id === duplicate._id.toString())) continue; // Skip if already found

        const textSimilarity = calculateSimilarity(input.title, duplicate.title);
        const keywordSimilarity = calculateKeywordSimilarity(input.title, duplicate.title);
        const averageSimilarity = (textSimilarity + keywordSimilarity) / 2;

        if (averageSimilarity > 0.75) {
          duplicates.push({
            id: duplicate._id.toString(),
            url: duplicate.url,
            title: duplicate.title,
            similarity: averageSimilarity,
            reason: `High title similarity (${(averageSimilarity * 100).toFixed(1)}%)`
          });

          issues.push({
            type: 'warning',
            field: 'title',
            message: `Potential duplicate detected based on title similarity`,
            originalValue: input.title,
            suggestedValue: duplicate.title
          });
        }
      }

      // 5. Analyze brand/model duplicates
      for (const duplicate of brandModelDuplicates) {
        if (duplicates.some(d => d.id === duplicate._id.toString())) continue; // Skip if already found

        duplicates.push({
          id: duplicate._id.toString(),
          url: duplicate.url,
          title: duplicate.title,
          similarity: 0.9,
          reason: `Exact brand and model match`
        });

        issues.push({
          type: 'error',
          field: 'brand_model',
          message: `Exact duplicate detected: same brand and model`,
          originalValue: `${input.brand} ${input.productModel}`,
          suggestedValue: `${duplicate.brand} ${duplicate.productModel}`
        });
      }

      // 6. Calculate overall confidence and generate recommendations
      if (duplicates.length > 0) {
        const highConfidenceDuplicates = duplicates.filter(d => d.similarity > 0.85);
        
        if (highConfidenceDuplicates.length > 0) {
          overallConfidence = 0.9;
          recommendations.push('High confidence duplicates detected - manual review recommended');
          recommendations.push('Consider merging or deduplicating these products');
        } else {
          overallConfidence = 0.7;
          recommendations.push('Potential duplicates detected - verify before proceeding');
        }

        if (duplicates.length > 3) {
          recommendations.push('Multiple potential duplicates found - systematic review needed');
        }
      } else {
        overallConfidence = 0.8;
        issues.push({
          type: 'info',
          field: 'duplicates',
          message: 'No duplicates detected'
        });
      }

      return {
        confidence: overallConfidence,
        issues,
        recommendations,
        duplicates: duplicates.length > 0 ? duplicates : undefined
      };

    } catch (error) {
      Sentry.captureException(error);
      console.error('Duplicate detection failed:', error);

      return {
        confidence: 0,
        issues: [{
          type: 'error',
          field: 'system',
          message: `Duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        recommendations: ['Unable to check for duplicates - system error']
      };
    }
  }

  /**
   * Normalize URL for consistent comparison
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim().toLowerCase();

    // Remove tracking parameters
    for (const pattern of URL_NORMALIZATION_PATTERNS.trackingParams) {
      normalized = normalized.replace(pattern, '');
    }

    // Remove session parameters
    for (const pattern of URL_NORMALIZATION_PATTERNS.sessionParams) {
      normalized = normalized.replace(pattern, '');
    }

    // Remove fragments
    normalized = normalized.replace(URL_NORMALIZATION_PATTERNS.fragments, '');

    // Extract domain and path
    try {
      const urlObj = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
      let domain = urlObj.hostname.replace(URL_NORMALIZATION_PATTERNS.www, '');
      let pathname = urlObj.pathname.replace(URL_NORMALIZATION_PATTERNS.trailingSlash, '');
      
      // Sort query parameters for consistent comparison
      const searchParams = new URLSearchParams(urlObj.search);
      const sortedParams = Array.from(searchParams.entries()).sort();
      const sortedSearch = sortedParams.length > 0 ? '?' + sortedParams.map(([k, v]) => `${k}=${v}`).join('&') : '';

      return `${domain}${pathname}${sortedSearch}`;
    } catch {
      // Fallback to basic normalization if URL parsing fails
      return normalized;
    }
  }

  /**
   * Calculate similarity between two normalized URLs
   */
  private calculateUrlSimilarity(url1: string, url2: string): number {
    // Exact match
    if (url1 === url2) return 1.0;

    // Domain comparison
    const domain1 = url1.split('/')[0];
    const domain2 = url2.split('/')[0];
    
    if (domain1 !== domain2) return 0.0; // Different domains

    // Path comparison using Levenshtein distance
    const path1 = url1.substring(domain1.length);
    const path2 = url2.substring(domain2.length);

    return calculateSimilarity(path1, path2);
  }

  /**
   * Find products with similar URLs
   */
  private async findUrlDuplicates(normalizedUrl: string): Promise<ProductSearchResult[]> {
    try {
      // Extract domain for domain-based search
      const domain = normalizedUrl.split('/')[0];
      
      // Find products from the same domain
      const products = await Product.find({
        url: { $regex: domain, $options: 'i' }
      }).select('_id url title').limit(50).lean();

      return products.filter((product: ProductSearchResult) => {
        const productNormalizedUrl = this.normalizeUrl(product.url);
        return this.calculateUrlSimilarity(normalizedUrl, productNormalizedUrl) > 0.6;
      });
    } catch (error) {
      console.error('URL duplicate search failed:', error);
      return [];
    }
  }

  /**
   * Find products with similar titles
   */
  private async findTitleDuplicates(title: string): Promise<ProductSearchResult[]> {
    try {
      const keywords = extractKeywords(title);
      if (keywords.length === 0) return [];

      // Create a regex pattern for fuzzy matching
      const keywordPattern = keywords.slice(0, 5).join('|'); // Use first 5 keywords
      
      const products = await Product.find({
        title: { $regex: keywordPattern, $options: 'i' }
      }).select('_id url title').limit(100).lean();

      return products.filter((product: ProductSearchResult) => {
        const similarity = calculateKeywordSimilarity(title, product.title);
        return similarity > 0.5;
      });
    } catch (error) {
      console.error('Title duplicate search failed:', error);
      return [];
    }
  }

  /**
   * Find products with exact brand and model match
   */
  private async findBrandModelDuplicates(brand: string, productModel: string): Promise<ProductSearchResult[]> {
    try {
      return await Product.find({
        brand: { $regex: `^${brand.trim()}$`, $options: 'i' },
        productModel: { $regex: `^${productModel.trim()}$`, $options: 'i' }
      }).select('_id url title brand productModel').limit(10).lean();
    } catch (error) {
      console.error('Brand/model duplicate search failed:', error);
      return [];
    }
  }
}

export const duplicateDetector = new DuplicateDetector(); 