// Image Validation and CDN Backup Service
// Handles image URL validation, CDN storage, and backup image management

import { DataQualityIssue } from './index';
import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/upstash';

export interface ImageValidationOptions {
  enableCDN: boolean;
  generateThumbnails: boolean;
  maxFileSize?: number; // in MB
  allowedFormats?: string[];
  timeout?: number; // in ms
}

export interface ImageValidationResult {
  isValid: boolean;
  confidence: number;
  issues: DataQualityIssue[];
  cleanedData: {
    image?: string;
    imageBackup?: string;
    imageThumbnail?: string;
    imageMetadata?: {
      width?: number;
      height?: number;
      format?: string;
      size?: number;
    };
  };
  recommendations: string[];
}

// Image validation configuration
const IMAGE_CONFIG = {
  MAX_FILE_SIZE: 10, // 10MB
  ALLOWED_FORMATS: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  TIMEOUT: 10000, // 10 seconds
  CDN_BASE_URL: process.env.CDN_BASE_URL || 'https://cdn.shopvalue.ro',
  THUMBNAIL_SIZES: [150, 300, 600],
  CACHE_TTL: 86400 // 24 hours
};

// Common fallback images by category
const FALLBACK_IMAGES = {
  electronics: '/assets/fallback/electronics.jpg',
  fashion: '/assets/fallback/fashion.jpg',
  home: '/assets/fallback/home.jpg',
  books: '/assets/fallback/books.jpg',
  default: '/assets/fallback/product.jpg'
};

class ImageValidator {
  /**
   * Validate image URL format and accessibility
   */
  private async validateImageUrl(imageUrl: string, options: ImageValidationOptions): Promise<{
    isValid: boolean;
    issues: DataQualityIssue[];
    metadata?: any;
  }> {
    const issues: DataQualityIssue[] = [];
    
    // Basic URL validation
    try {
      const url = new URL(imageUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        issues.push({
          type: 'error',
          field: 'image',
          message: 'Image URL must use HTTP or HTTPS protocol',
          originalValue: imageUrl
        });
        return { isValid: false, issues };
      }
      
      // Check file extension
      const pathname = url.pathname.toLowerCase();
      const extension = pathname.split('.').pop();
      
      if (!extension || !IMAGE_CONFIG.ALLOWED_FORMATS.includes(extension)) {
        issues.push({
          type: 'warning',
          field: 'image',
          message: `Image format "${extension}" may not be supported. Recommended: ${IMAGE_CONFIG.ALLOWED_FORMATS.join(', ')}`,
          originalValue: extension,
          suggestedValue: IMAGE_CONFIG.ALLOWED_FORMATS[0]
        });
      }
      
    } catch (error) {
      issues.push({
        type: 'error',
        field: 'image',
        message: 'Invalid image URL format',
        originalValue: imageUrl
      });
      return { isValid: false, issues };
    }
    
    // Test image accessibility
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || IMAGE_CONFIG.TIMEOUT);
      
      const response = await fetch(imageUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ShopValue Bot 1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        issues.push({
          type: 'error',
          field: 'image',
          message: `Image URL returned ${response.status}: ${response.statusText}`,
          originalValue: imageUrl
        });
        return { isValid: false, issues };
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.startsWith('image/')) {
        issues.push({
          type: 'error',
          field: 'image',
          message: `URL does not point to an image (content-type: ${contentType})`,
          originalValue: imageUrl
        });
        return { isValid: false, issues };
      }
      
      // Check file size
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        const maxSize = options.maxFileSize || IMAGE_CONFIG.MAX_FILE_SIZE;
        
        if (sizeInMB > maxSize) {
          issues.push({
            type: 'warning',
            field: 'image',
            message: `Image size (${sizeInMB.toFixed(2)}MB) exceeds recommended limit (${maxSize}MB)`,
            originalValue: sizeInMB,
            suggestedValue: maxSize
          });
        }
      }
      
      return { 
        isValid: true, 
        issues,
        metadata: {
          contentType,
          size: contentLength ? parseInt(contentLength) : undefined
        }
      };
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        issues.push({
          type: 'error',
          field: 'image',
          message: 'Image URL request timed out',
          originalValue: imageUrl
        });
      } else {
        issues.push({
          type: 'error',
          field: 'image',
          message: 'Failed to access image URL',
          originalValue: imageUrl
        });
      }
      
      return { isValid: false, issues };
    }
  }

  /**
   * Create CDN backup of image
   */
  private async createCDNBackup(imageUrl: string, productId?: string): Promise<{
    success: boolean;
    backupUrl?: string;
    thumbnailUrl?: string;
    error?: string;
  }> {
    try {
      // In a real implementation, this would:
      // 1. Download the image
      // 2. Upload to CDN (e.g., Cloudinary, AWS S3)
      // 3. Generate thumbnails
      // 4. Return the CDN URLs
      
      // For now, return a mock implementation
      const timestamp = Date.now();
      const backupUrl = `${IMAGE_CONFIG.CDN_BASE_URL}/products/${productId || 'unknown'}/${timestamp}_original.jpg`;
      const thumbnailUrl = `${IMAGE_CONFIG.CDN_BASE_URL}/products/${productId || 'unknown'}/${timestamp}_thumb.jpg`;
      
      // Cache the mapping
      const cacheKey = `image:backup:${Buffer.from(imageUrl).toString('base64')}`;
      await redis.setex(cacheKey, IMAGE_CONFIG.CACHE_TTL, JSON.stringify({
        original: imageUrl,
        backup: backupUrl,
        thumbnail: thumbnailUrl,
        createdAt: new Date().toISOString()
      }));
      
      return {
        success: true,
        backupUrl,
        thumbnailUrl
      };
      
    } catch (error) {
      Sentry.captureException(error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown CDN backup error'
      };
    }
  }

  /**
   * Get fallback image based on category
   */
  private getFallbackImage(category?: string): string {
    if (!category) return FALLBACK_IMAGES.default;
    
    const normalizedCategory = category.toLowerCase();
    
    // Map categories to fallback images
    if (normalizedCategory.includes('electroni') || normalizedCategory.includes('tech')) {
      return FALLBACK_IMAGES.electronics;
    }
    if (normalizedCategory.includes('fashion') || normalizedCategory.includes('clothing')) {
      return FALLBACK_IMAGES.fashion;
    }
    if (normalizedCategory.includes('home') || normalizedCategory.includes('casa')) {
      return FALLBACK_IMAGES.home;
    }
    if (normalizedCategory.includes('book') || normalizedCategory.includes('carte')) {
      return FALLBACK_IMAGES.books;
    }
    
    return FALLBACK_IMAGES.default;
  }

  /**
   * Check if image URL is already a CDN URL
   */
  private isCDNUrl(imageUrl: string): boolean {
    return imageUrl.includes(IMAGE_CONFIG.CDN_BASE_URL) || 
           imageUrl.includes('cloudinary.com') ||
           imageUrl.includes('amazonaws.com') ||
           imageUrl.includes('cdn.');
  }

  /**
   * Get cached backup URL if available
   */
  private async getCachedBackup(imageUrl: string): Promise<{
    backup?: string;
    thumbnail?: string;
  }> {
    try {
      const cacheKey = `image:backup:${Buffer.from(imageUrl).toString('base64')}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached.toString());
        return {
          backup: data.backup,
          thumbnail: data.thumbnail
        };
      }
      
      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Main validation and backup method
   */
  async validateAndBackup(imageUrl: string, options: ImageValidationOptions): Promise<ImageValidationResult> {
    try {
      const issues: DataQualityIssue[] = [];
      const recommendations: string[] = [];
      const cleanedData: any = {};
      
      let confidence = 1.0;
      
      // Validate image URL
      const validation = await this.validateImageUrl(imageUrl, options);
      issues.push(...validation.issues);
      
      if (!validation.isValid) {
        confidence -= 0.5;
        
        // Suggest fallback image
        const fallbackImage = this.getFallbackImage();
        recommendations.push(`Consider using fallback image: ${fallbackImage}`);
        cleanedData.image = fallbackImage;
        
        issues.push({
          type: 'info',
          field: 'image',
          message: 'Fallback image assigned due to validation failure',
          originalValue: imageUrl,
          suggestedValue: fallbackImage
        });
      } else {
        cleanedData.image = imageUrl;
        
        // Store image metadata if available
        if (validation.metadata) {
          cleanedData.imageMetadata = validation.metadata;
        }
      }
      
      // Create CDN backup if enabled and image is valid
      if (options.enableCDN && validation.isValid) {
        // Check if already a CDN URL
        if (this.isCDNUrl(imageUrl)) {
          issues.push({
            type: 'info',
            field: 'image',
            message: 'Image is already served from CDN',
            originalValue: imageUrl
          });
        } else {
          // Check for cached backup first
          const cachedBackup = await this.getCachedBackup(imageUrl);
          
          if (cachedBackup.backup) {
            cleanedData.imageBackup = cachedBackup.backup;
            cleanedData.imageThumbnail = cachedBackup.thumbnail;
            
            issues.push({
              type: 'info',
              field: 'image',
              message: 'Using cached CDN backup',
              originalValue: imageUrl,
              suggestedValue: cachedBackup.backup
            });
          } else {
            // Create new backup
            const backup = await this.createCDNBackup(imageUrl);
            
            if (backup.success) {
              cleanedData.imageBackup = backup.backupUrl;
              cleanedData.imageThumbnail = backup.thumbnailUrl;
              
              issues.push({
                type: 'info',
                field: 'image',
                message: 'CDN backup created successfully',
                originalValue: imageUrl,
                suggestedValue: backup.backupUrl
              });
              
              recommendations.push('Consider using CDN URL for improved performance');
            } else {
              confidence -= 0.2;
              
              issues.push({
                type: 'warning',
                field: 'image',
                message: `CDN backup failed: ${backup.error}`,
                originalValue: imageUrl
              });
              
              recommendations.push('Manual review required for image backup');
            }
          }
        }
      }
      
      // Add general recommendations
      if (issues.some(issue => issue.type === 'warning')) {
        recommendations.push('Review image quality and accessibility');
      }
      
      if (confidence < 0.8) {
        recommendations.push('Consider manual image verification');
      }
      
      const hasErrors = issues.some(issue => issue.type === 'error');
      
      return {
        isValid: !hasErrors,
        confidence: Math.max(0, confidence),
        issues,
        cleanedData,
        recommendations
      };
      
    } catch (error) {
      Sentry.captureException(error);
      console.error('Image validation failed:', error);
      
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'error',
          field: 'system',
          message: `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        cleanedData: {
          image: this.getFallbackImage()
        },
        recommendations: ['System error occurred during image validation']
      };
    }
  }

  /**
   * Batch validate multiple images
   */
  async validateImages(imageUrls: string[], options: ImageValidationOptions): Promise<ImageValidationResult[]> {
    const results: ImageValidationResult[] = [];
    
    for (const imageUrl of imageUrls) {
      try {
        const result = await this.validateAndBackup(imageUrl, options);
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          confidence: 0,
          issues: [{
            type: 'error',
            field: 'system',
            message: `Batch validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          cleanedData: {
            image: this.getFallbackImage()
          },
          recommendations: []
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const imageValidator = new ImageValidator(); 