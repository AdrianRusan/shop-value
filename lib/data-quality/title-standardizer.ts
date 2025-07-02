// Product Title Standardization Service
// Handles title cleanup, brand/category detection, and standardization

import { DataQualityIssue } from './index';
import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/upstash';

export interface TitleStandardizationOptions {
  brand?: string;
  category?: string;
  source?: string;
  preserveOriginal?: boolean;
}

export interface TitleStandardizationResult {
  isValid: boolean;
  confidence: number;
  issues: DataQualityIssue[];
  cleanedData: {
    title?: string;
    originalTitle?: string;
    brand?: string;
    productModel?: string;
    category?: string;
    keywords?: string[];
    titleMetadata?: {
      length: number;
      wordCount: number;
      hasSpecialChars: boolean;
      detectedLanguage: string;
    };
  };
  recommendations: string[];
}

// Title standardization configuration
const TITLE_CONFIG = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 200,
  IDEAL_LENGTH: 60,
  MIN_WORDS: 2,
  MAX_WORDS: 20,
  CACHE_TTL: 86400 // 24 hours
};

// Common brand variations and normalizations
const BRAND_MAPPINGS: Record<string, string> = {
  'samsung': 'Samsung',
  'apple': 'Apple',
  'huawei': 'Huawei',
  'xiaomi': 'Xiaomi',
  'oneplus': 'OnePlus',
  'google': 'Google',
  'sony': 'Sony',
  'lg': 'LG',
  'nokia': 'Nokia',
  'motorola': 'Motorola',
  'realme': 'Realme',
  'oppo': 'OPPO',
  'vivo': 'Vivo',
  'asus': 'ASUS',
  'lenovo': 'Lenovo',
  'hp': 'HP',
  'dell': 'Dell',
  'acer': 'Acer',
  'msi': 'MSI',
  'razer': 'Razer',
  'logitech': 'Logitech',
  'corsair': 'Corsair',
  'steelseries': 'SteelSeries',
  'hyperx': 'HyperX',
  'nike': 'Nike',
  'adidas': 'Adidas',
  'puma': 'Puma',
  'reebok': 'Reebok',
  'under armour': 'Under Armour',
  'zara': 'Zara',
  'h&m': 'H&M',
  'uniqlo': 'Uniqlo'
};

// Common stop words to remove/minimize
const STOP_WORDS = [
  'și', 'și', 'cu', 'de', 'la', 'pentru', 'în', 'pe', 'din', 'prin',
  'and', 'with', 'for', 'in', 'on', 'from', 'through', 'the', 'a', 'an',
  'new', 'nou', 'original', 'genuine', 'autentic', 'produs', 'product'
];

// Category keywords for detection
const CATEGORY_KEYWORDS = {
  'electronics': ['telefon', 'smartphone', 'laptop', 'calculator', 'tablet', 'monitor', 'tv', 'televizor'],
  'fashion': ['tricou', 'pantaloni', 'rochie', 'pantofi', 'geaca', 'pulover', 'camasa'],
  'home': ['masa', 'scaun', 'pat', 'dulap', 'canapea', 'fotoliu', 'lampa'],
  'books': ['carte', 'roman', 'manual', 'ghid', 'enciclopedie'],
  'sports': ['bicicleta', 'minge', 'racheta', 'echipament', 'fitness'],
  'beauty': ['parfum', 'crema', 'sampon', 'machiaj', 'cosmetice'],
  'auto': ['anvelope', 'accesorii', 'piese', 'auto', 'masina']
};

class TitleStandardizer {
  /**
   * Clean and normalize title text
   */
  private cleanTitle(title: string): string {
    return title
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters at start/end
      .replace(/^[^\w\s]+|[^\w\s]+$/g, '')
      // Normalize quotes
      .replace(/[""'']/g, '"')
      // Remove excessive punctuation
      .replace(/[!]{2,}/g, '!')
      .replace(/[?]{2,}/g, '?')
      .replace(/[.]{3,}/g, '...')
      // Clean up dashes and separators
      .replace(/[-−–—]+/g, '-')
      .replace(/\s*-\s*/g, ' - ')
      // Trim
      .trim();
  }

  /**
   * Detect brand from title
   */
  private detectBrand(title: string, providedBrand?: string): {
    brand: string | undefined;
    confidence: number;
    position?: number;
  } {
    const normalizedTitle = title.toLowerCase();
    
    // First check provided brand
    if (providedBrand) {
      const normalizedBrand = providedBrand.toLowerCase();
      if (normalizedTitle.includes(normalizedBrand)) {
        return {
          brand: BRAND_MAPPINGS[normalizedBrand] || providedBrand,
          confidence: 0.9,
          position: normalizedTitle.indexOf(normalizedBrand)
        };
      }
    }
    
    // Check known brands
    for (const [key, brand] of Object.entries(BRAND_MAPPINGS)) {
      const brandIndex = normalizedTitle.indexOf(key);
      if (brandIndex !== -1) {
        // Higher confidence if brand is at the beginning
        const confidence = brandIndex === 0 ? 0.95 : 0.8;
        return {
          brand,
          confidence,
          position: brandIndex
        };
      }
    }
    
    return { brand: undefined, confidence: 0 };
  }

  /**
   * Detect category from title
   */
  private detectCategory(title: string, providedCategory?: string): {
    category: string | undefined;
    confidence: number;
  } {
    if (providedCategory) {
      return { category: providedCategory, confidence: 0.9 };
    }
    
    const normalizedTitle = title.toLowerCase();
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalizedTitle.includes(keyword)) {
          return { category, confidence: 0.7 };
        }
      }
    }
    
    return { category: undefined, confidence: 0 };
  }

  /**
   * Extract product model from title
   */
  private extractProductModel(title: string, brand?: string): {
    model: string | undefined;
    confidence: number;
  } {
    const normalizedTitle = title.toLowerCase();
    
    // Remove brand from title for model extraction
    let titleWithoutBrand = normalizedTitle;
    if (brand) {
      titleWithoutBrand = normalizedTitle.replace(brand.toLowerCase(), '').trim();
    }
    
    // Look for model patterns
    const modelPatterns = [
      // Alphanumeric models: iPhone 15, Galaxy S24, etc.
      /([a-z]+\s*\d+[a-z]*(?:\s*[a-z]+)?)/i,
      // Model numbers: Model XYZ-123
      /model\s+([a-z0-9-]+)/i,
      // Series patterns: Series X, Generation 5
      /(series|gen|generation)\s+([a-z0-9]+)/i,
      // Version patterns: v2, 2.0, Pro Max
      /(v\d+|pro|max|plus|mini|ultra|lite)/i
    ];
    
    for (const pattern of modelPatterns) {
      const match = titleWithoutBrand.match(pattern);
      if (match) {
        const model = match[1] || match[0];
        return {
          model: model.trim(),
          confidence: 0.7
        };
      }
    }
    
    return { model: undefined, confidence: 0 };
  }

  /**
   * Extract keywords from title
   */
  private extractKeywords(title: string): string[] {
    const words = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.includes(word));
    
    // Remove duplicates and sort by relevance (longer words first)
    return Array.from(new Set(words))
      .sort((a, b) => b.length - a.length)
      .slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Detect language of title
   */
  private detectLanguage(title: string): string {
    const romanianWords = ['și', 'cu', 'de', 'la', 'pentru', 'în', 'pe', 'din', 'prin', 'lei', 'produs'];
    const englishWords = ['and', 'with', 'for', 'in', 'on', 'from', 'through', 'the', 'product'];
    
    const normalizedTitle = title.toLowerCase();
    
    let romanianScore = 0;
    let englishScore = 0;
    
    romanianWords.forEach(word => {
      if (normalizedTitle.includes(word)) romanianScore++;
    });
    
    englishWords.forEach(word => {
      if (normalizedTitle.includes(word)) englishScore++;
    });
    
    if (romanianScore > englishScore) return 'ro';
    if (englishScore > romanianScore) return 'en';
    
    // Default to Romanian for Romanian market
    return 'ro';
  }

  /**
   * Validate title quality
   */
  private validateTitle(title: string): { isValid: boolean; issues: DataQualityIssue[] } {
    const issues: DataQualityIssue[] = [];
    
    // Length validation
    if (title.length < TITLE_CONFIG.MIN_LENGTH) {
      issues.push({
        type: 'error',
        field: 'title',
        message: `Title too short (${title.length} chars). Minimum: ${TITLE_CONFIG.MIN_LENGTH}`,
        originalValue: title.length,
        suggestedValue: TITLE_CONFIG.MIN_LENGTH
      });
    }
    
    if (title.length > TITLE_CONFIG.MAX_LENGTH) {
      issues.push({
        type: 'warning',
        field: 'title',
        message: `Title too long (${title.length} chars). Maximum: ${TITLE_CONFIG.MAX_LENGTH}`,
        originalValue: title.length,
        suggestedValue: TITLE_CONFIG.MAX_LENGTH
      });
    }
    
    // Word count validation
    const wordCount = title.split(/\s+/).length;
    if (wordCount < TITLE_CONFIG.MIN_WORDS) {
      issues.push({
        type: 'error',
        field: 'title',
        message: `Title has too few words (${wordCount}). Minimum: ${TITLE_CONFIG.MIN_WORDS}`,
        originalValue: wordCount,
        suggestedValue: TITLE_CONFIG.MIN_WORDS
      });
    }
    
    if (wordCount > TITLE_CONFIG.MAX_WORDS) {
      issues.push({
        type: 'warning',
        field: 'title',
        message: `Title has too many words (${wordCount}). Maximum: ${TITLE_CONFIG.MAX_WORDS}`,
        originalValue: wordCount,
        suggestedValue: TITLE_CONFIG.MAX_WORDS
      });
    }
    
    // Content validation
    if (title.toUpperCase() === title && title.length > 10) {
      issues.push({
        type: 'warning',
        field: 'title',
        message: 'Title is all uppercase, consider proper case formatting',
        originalValue: title
      });
    }
    
    if (title.toLowerCase() === title && title.length > 10) {
      issues.push({
        type: 'warning',
        field: 'title',
        message: 'Title is all lowercase, consider proper case formatting',
        originalValue: title
      });
    }
    
    // Special characters validation
    const specialCharsCount = (title.match(/[^\w\s\-\.\,\!\?]/g) || []).length;
    if (specialCharsCount > 5) {
      issues.push({
        type: 'warning',
        field: 'title',
        message: `Title contains many special characters (${specialCharsCount})`,
        originalValue: specialCharsCount
      });
    }
    
    const hasErrors = issues.some(issue => issue.type === 'error');
    return { isValid: !hasErrors, issues };
  }

  /**
   * Format title with proper case
   */
  private formatTitle(title: string): string {
    return title
      .split(' ')
      .map(word => {
        // Keep acronyms uppercase
        if (word.length <= 3 && word.toUpperCase() === word) {
          return word;
        }
        // Capitalize first letter, lowercase rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Main standardization method
   */
  async standardize(title: string, options: TitleStandardizationOptions = {}): Promise<TitleStandardizationResult> {
    try {
      const issues: DataQualityIssue[] = [];
      const recommendations: string[] = [];
      const cleanedData: any = {};
      
      // Store original title
      cleanedData.originalTitle = options.preserveOriginal ? title : undefined;
      
      // Clean title
      const cleanedTitle = this.cleanTitle(title);
      
      if (cleanedTitle !== title) {
        issues.push({
          type: 'info',
          field: 'title',
          message: 'Title was cleaned and normalized',
          originalValue: title,
          suggestedValue: cleanedTitle
        });
      }
      
      // Validate title
      const validation = this.validateTitle(cleanedTitle);
      issues.push(...validation.issues);
      
      let confidence = validation.isValid ? 1.0 : 0.6;
      
      // Detect brand
      const brandDetection = this.detectBrand(cleanedTitle, options.brand);
      if (brandDetection.brand) {
        cleanedData.brand = brandDetection.brand;
        confidence += 0.1;
        
        if (brandDetection.confidence < 0.8) {
          issues.push({
            type: 'warning',
            field: 'brand',
            message: `Brand detection has low confidence (${brandDetection.confidence})`,
            originalValue: brandDetection.brand
          });
        }
      }
      
      // Detect category
      const categoryDetection = this.detectCategory(cleanedTitle, options.category);
      if (categoryDetection.category) {
        cleanedData.category = categoryDetection.category;
        confidence += 0.1;
      }
      
      // Extract product model
      const modelDetection = this.extractProductModel(cleanedTitle, cleanedData.brand);
      if (modelDetection.model) {
        cleanedData.productModel = modelDetection.model;
        confidence += 0.1;
      }
      
      // Extract keywords
      cleanedData.keywords = this.extractKeywords(cleanedTitle);
      
      // Format title
      const formattedTitle = this.formatTitle(cleanedTitle);
      cleanedData.title = formattedTitle;
      
      // Add metadata
      cleanedData.titleMetadata = {
        length: formattedTitle.length,
        wordCount: formattedTitle.split(/\s+/).length,
        hasSpecialChars: /[^\w\s\-\.\,\!\?]/.test(formattedTitle),
        detectedLanguage: this.detectLanguage(formattedTitle)
      };
      
      // Generate recommendations
      if (formattedTitle.length > TITLE_CONFIG.IDEAL_LENGTH) {
        recommendations.push('Consider shortening title for better readability');
      }
      
      if (!cleanedData.brand) {
        recommendations.push('Consider adding brand information to title');
      }
      
      if (!cleanedData.category) {
        recommendations.push('Consider adding category-specific keywords');
      }
      
      if (issues.some(issue => issue.type === 'warning')) {
        recommendations.push('Review title formatting and content');
      }
      
      const hasErrors = issues.some(issue => issue.type === 'error');
      
      return {
        isValid: !hasErrors,
        confidence: Math.min(1.0, confidence),
        issues,
        cleanedData,
        recommendations
      };
      
    } catch (error) {
      Sentry.captureException(error);
      console.error('Title standardization failed:', error);
      
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'error',
          field: 'system',
          message: `Title standardization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        cleanedData: {
          title: title,
          originalTitle: title
        },
        recommendations: ['System error occurred during title standardization']
      };
    }
  }

  /**
   * Batch standardize multiple titles
   */
  async standardizeTitles(
    titles: { title: string; options?: TitleStandardizationOptions }[]
  ): Promise<TitleStandardizationResult[]> {
    const results: TitleStandardizationResult[] = [];
    
    for (const { title, options } of titles) {
      try {
        const result = await this.standardize(title, options);
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          confidence: 0,
          issues: [{
            type: 'error',
            field: 'system',
            message: `Batch standardization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          cleanedData: { title, originalTitle: title },
          recommendations: []
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const titleStandardizer = new TitleStandardizer(); 