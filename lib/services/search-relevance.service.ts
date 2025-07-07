import { redis } from '@/lib/upstash';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';

// Type for product document - using any for now as IProduct is not exported
type ProductDocument = any;

// Types for search relevance scoring
export interface SearchRelevanceOptions {
  query: string;
  userId?: string;
  userTier?: 'free' | 'premium' | 'enterprise';
  abTestGroup?: 'control' | 'experiment_a' | 'experiment_b';
  includePersonalization?: boolean;
  includeFreshness?: boolean;
  includeFuzzyMatching?: boolean;
  includeSynonyms?: boolean;
}

export interface RelevanceScore {
  totalScore: number;
  breakdown: {
    textMatch: number;
    popularity: number;
    userEngagement: number;
    contentFreshness: number;
    fuzzyMatch: number;
    synonymMatch: number;
    personalization: number;
    abTestAdjustment: number;
  };
  confidence: number;
}

export interface ScoredProduct extends ProductDocument {
  relevanceScore: RelevanceScore;
  searchMetadata: {
    matchedTerms: string[];
    highlightedText: string;
    relevanceRank: number;
  };
}

// Synonym mapping for better search relevance
const SYNONYM_MAP: Record<string, string[]> = {
  'telefon': ['smartphone', 'mobile', 'celular', 'phone'],
  'smartphone': ['telefon', 'mobile', 'celular', 'phone'],
  'laptop': ['notebook', 'computer', 'pc portabil'],
  'computer': ['laptop', 'notebook', 'pc', 'calculator'],
  'televizor': ['tv', 'smart tv', 'led tv', 'oled'],
  'tv': ['televizor', 'smart tv', 'led tv', 'oled'],
  'frigider': ['combina frigorifica', 'frigider-congelator'],
  'masina': ['autoturism', 'vehicul', 'automobil'],
  'casa': ['locuinta', 'proprietate', 'imobil'],
  'apartament': ['garsoniera', 'studio', 'locuinta'],
  'ieftin': ['redus', 'promotie', 'discount', 'oferta'],
  'scump': ['premium', 'lux', 'expensive', 'high-end'],
  'nou': ['recent', 'fresh', 'latest', 'new'],
  'vechi': ['second hand', 'folosit', 'refurbished', 'old']
};

// A/B Testing configurations
const AB_TEST_CONFIGS = {
  control: {
    textMatchWeight: 0.35,
    popularityWeight: 0.25,
    userEngagementWeight: 0.20,
    freshnessWeight: 0.10,
    fuzzyMatchWeight: 0.05,
    synonymWeight: 0.05
  },
  experiment_a: {
    textMatchWeight: 0.30,
    popularityWeight: 0.20,
    userEngagementWeight: 0.25,
    freshnessWeight: 0.15,
    fuzzyMatchWeight: 0.05,
    synonymWeight: 0.05
  },
  experiment_b: {
    textMatchWeight: 0.25,
    popularityWeight: 0.15,
    userEngagementWeight: 0.30,
    freshnessWeight: 0.15,
    fuzzyMatchWeight: 0.10,
    synonymWeight: 0.05
  }
};

export class SearchRelevanceService {
  private static instance: SearchRelevanceService;
  private cachedSynonyms: Map<string, string[]> = new Map();
  private userEngagementCache: Map<string, number> = new Map();

  public static getInstance(): SearchRelevanceService {
    if (!SearchRelevanceService.instance) {
      SearchRelevanceService.instance = new SearchRelevanceService();
    }
    return SearchRelevanceService.instance;
  }

  constructor() {
    this.initializeSynonyms();
  }

  private initializeSynonyms(): void {
    // Pre-populate synonym cache
    Object.entries(SYNONYM_MAP).forEach(([key, synonyms]) => {
      this.cachedSynonyms.set(key.toLowerCase(), synonyms.map(s => s.toLowerCase()));
    });
  }

  /**
   * Calculate comprehensive relevance score for a product
   */
  public async calculateRelevanceScore(
    product: ProductDocument,
    options: SearchRelevanceOptions
  ): Promise<RelevanceScore> {
    const weights = AB_TEST_CONFIGS[options.abTestGroup || 'control'];
    
    // Calculate individual scoring components
    const textMatch = this.calculateTextMatchScore(product, options.query);
    const popularity = this.calculatePopularityScore(product);
    const userEngagement = await this.calculateUserEngagementScore(product, options.userId);
    const contentFreshness = this.calculateContentFreshnessScore(product);
    const fuzzyMatch = options.includeFuzzyMatching ? 
      this.calculateFuzzyMatchScore(product, options.query) : 0;
    const synonymMatch = options.includeSynonyms ? 
      this.calculateSynonymMatchScore(product, options.query) : 0;
    const personalization = options.includePersonalization && options.userId ? 
      await this.calculatePersonalizationScore(product, options.userId) : 0;
    const abTestAdjustment = this.calculateABTestAdjustment(product, options.abTestGroup || 'control');

    // Calculate weighted total score
    const totalScore = 
      (textMatch * weights.textMatchWeight) +
      (popularity * weights.popularityWeight) +
      (userEngagement * weights.userEngagementWeight) +
      (contentFreshness * weights.freshnessWeight) +
      (fuzzyMatch * weights.fuzzyMatchWeight) +
      (synonymMatch * weights.synonymWeight) +
      (personalization * 0.1) + // Fixed small weight for personalization
      (abTestAdjustment * 0.05); // Fixed small weight for A/B adjustments

    // Calculate confidence score based on data completeness
    const confidence = this.calculateConfidenceScore(product, options);

    return {
      totalScore: Math.max(0, Math.min(100, totalScore)),
      breakdown: {
        textMatch,
        popularity,
        userEngagement,
        contentFreshness,
        fuzzyMatch,
        synonymMatch,
        personalization,
        abTestAdjustment
      },
      confidence
    };
  }

  /**
   * Calculate text match score based on exact and partial matches
   */
  private calculateTextMatchScore(product: ProductDocument, query: string): number {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const title = product.title?.toLowerCase() || '';
    const brand = product.brand?.toLowerCase() || '';
    const category = product.category?.toLowerCase() || '';
    const description = product.description?.toLowerCase() || '';
    
    let score = 0;
    const maxScore = 100;
    
    searchTerms.forEach(term => {
      // Exact title match (highest weight)
      if (title.includes(term)) {
        score += title === term ? 25 : 15; // Full match vs partial
      }
      
      // Brand match (high weight)
      if (brand.includes(term)) {
        score += brand === term ? 20 : 10;
      }
      
      // Category match (medium weight)
      if (category.includes(term)) {
        score += category === term ? 15 : 8;
      }
      
      // Description match (lower weight)
      if (description.includes(term)) {
        score += 5;
      }
    });
    
    return Math.min(maxScore, score);
  }

  /**
   * Calculate popularity score based on various engagement metrics
   */
  private calculatePopularityScore(product: ProductDocument): number {
    const analytics = product.analytics || {};
    const popularityScore = analytics.popularityScore || 0;
    const trackingCount = analytics.trackingCount || 0;
    const viewCount = analytics.viewCount || 0;
    const clickCount = analytics.clickCount || 0;
    
    // Normalize scores to 0-100 range
    const normalizedPopularity = Math.min(100, popularityScore * 10);
    const normalizedTracking = Math.min(100, trackingCount * 2);
    const normalizedViews = Math.min(100, viewCount * 0.1);
    const normalizedClicks = Math.min(100, clickCount * 0.5);
    
    return (normalizedPopularity + normalizedTracking + normalizedViews + normalizedClicks) / 4;
  }

  /**
   * Calculate user engagement score based on historical interactions
   */
  private async calculateUserEngagementScore(product: ProductDocument, userId?: string): Promise<number> {
    if (!userId) return 0;
    
    try {
      const cacheKey = `user_engagement:${userId}:${product._id}`;
      
      // Check cache first
      if (this.userEngagementCache.has(cacheKey)) {
        return this.userEngagementCache.get(cacheKey)!;
      }
      
      // Get user engagement data from Redis
      const engagementData = await redis.get(`user:${userId}:product:${product._id}`);
      
      if (!engagementData) return 0;
      
      const engagement = JSON.parse(engagementData as string);
      let score = 0;
      
      // Score based on different engagement types
      if (engagement.viewed) score += 10;
      if (engagement.clicked) score += 15;
      if (engagement.tracked) score += 25;
      if (engagement.shared) score += 20;
      if (engagement.purchased) score += 50;
      
      // Recency bonus (more recent interactions get higher scores)
      const daysSinceLastInteraction = (Date.now() - engagement.lastInteraction) / (1000 * 60 * 60 * 24);
      const recencyBonus = Math.max(0, 20 - daysSinceLastInteraction);
      score += recencyBonus;
      
      const finalScore = Math.min(100, score);
      this.userEngagementCache.set(cacheKey, finalScore);
      
      return finalScore;
    } catch (error) {
      console.error('Error calculating user engagement score:', error);
      return 0;
    }
  }

  /**
   * Calculate content freshness score based on product age and update frequency
   */
  private calculateContentFreshnessScore(product: ProductDocument): number {
    const now = new Date();
    const createdAt = new Date(product.createdAt);
    const updatedAt = new Date(product.updatedAt);
    const lastPriceUpdate = product.priceHistory?.length > 0 ? 
      new Date(product.priceHistory[product.priceHistory.length - 1].date) : createdAt;
    
    // Calculate age in days
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysSincePriceUpdate = (now.getTime() - lastPriceUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Freshness score decreases with age
    const creationFreshness = Math.max(0, 100 - (daysSinceCreation * 0.5));
    const updateFreshness = Math.max(0, 100 - (daysSinceUpdate * 2));
    const priceUpdateFreshness = Math.max(0, 100 - (daysSincePriceUpdate * 1));
    
    return (creationFreshness + updateFreshness + priceUpdateFreshness) / 3;
  }

  /**
   * Calculate fuzzy match score using Levenshtein distance
   */
  private calculateFuzzyMatchScore(product: ProductDocument, query: string): number {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const title = product.title?.toLowerCase() || '';
    const brand = product.brand?.toLowerCase() || '';
    
    let totalScore = 0;
    let matchCount = 0;
    
    searchTerms.forEach(term => {
      // Check fuzzy match against title words
      const titleWords = title.split(/\s+/);
      titleWords.forEach((word: string) => {
        if (word.length > 2) {
          const similarity = this.calculateStringSimilarity(term, word);
          if (similarity > 0.7) {
            totalScore += similarity * 30;
            matchCount++;
          }
        }
      });
      
      // Check fuzzy match against brand
      if (brand.length > 0) {
        const brandSimilarity = this.calculateStringSimilarity(term, brand);
        if (brandSimilarity > 0.7) {
          totalScore += brandSimilarity * 25;
          matchCount++;
        }
      }
    });
    
    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  /**
   * Calculate synonym match score
   */
  private calculateSynonymMatchScore(product: ProductDocument, query: string): number {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const title = product.title?.toLowerCase() || '';
    const description = product.description?.toLowerCase() || '';
    
    let score = 0;
    
    searchTerms.forEach(term => {
      const synonyms = this.cachedSynonyms.get(term) || [];
      
      synonyms.forEach(synonym => {
        if (title.includes(synonym)) {
          score += 15;
        }
        if (description.includes(synonym)) {
          score += 8;
        }
      });
    });
    
    return Math.min(100, score);
  }

  /**
   * Calculate personalization score based on user preferences
   */
  private async calculatePersonalizationScore(product: ProductDocument, userId: string): Promise<number> {
    try {
      const userPreferences = await redis.get(`user:${userId}:preferences`);
      if (!userPreferences) return 0;
      
      const preferences = JSON.parse(userPreferences as string);
      let score = 0;
      
      // Brand preference
      if (preferences.favoriteBrands?.includes(product.brand)) {
        score += 30;
      }
      
      // Category preference
      if (preferences.favoriteCategories?.includes(product.category)) {
        score += 25;
      }
      
      // Price range preference
      if (preferences.priceRange && product.currentPrice) {
        const { min, max } = preferences.priceRange;
        if (product.currentPrice >= min && product.currentPrice <= max) {
          score += 20;
        }
      }
      
      return Math.min(100, score);
    } catch (error) {
      console.error('Error calculating personalization score:', error);
      return 0;
    }
  }

  /**
   * Calculate A/B test adjustment based on test group
   */
  private calculateABTestAdjustment(product: ProductDocument, abTestGroup: string): number {
    // Simple A/B test adjustments based on product characteristics
    switch (abTestGroup) {
      case 'experiment_a':
        // Boost newer products
        const daysSinceCreation = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation < 30 ? 10 : 0;
      
      case 'experiment_b':
        // Boost products with reviews
        return (product.reviewsCount || 0) > 0 ? 15 : 0;
      
      default:
        return 0;
    }
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidenceScore(product: ProductDocument, options: SearchRelevanceOptions): number {
    let dataPoints = 0;
    let completedPoints = 0;
    
    // Check title completeness
    dataPoints++;
    if (product.title && product.title.length > 0) completedPoints++;
    
    // Check brand completeness
    dataPoints++;
    if (product.brand && product.brand.length > 0) completedPoints++;
    
    // Check analytics data
    dataPoints++;
    if (product.analytics && Object.keys(product.analytics).length > 0) completedPoints++;
    
    // Check price history
    dataPoints++;
    if (product.priceHistory && product.priceHistory.length > 0) completedPoints++;
    
    // Check user engagement data (if user provided)
    if (options.userId) {
      dataPoints++;
      if (this.userEngagementCache.has(`user_engagement:${options.userId}:${product._id}`)) {
        completedPoints++;
      }
    }
    
    return (completedPoints / dataPoints) * 100;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Sort products by relevance score
   */
  public sortByRelevance(products: ScoredProduct[]): ScoredProduct[] {
    return products.sort((a, b) => {
      // Primary sort: relevance score (descending)
      const scoreDiff = b.relevanceScore.totalScore - a.relevanceScore.totalScore;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      
      // Secondary sort: confidence (descending)
      const confidenceDiff = b.relevanceScore.confidence - a.relevanceScore.confidence;
      if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;
      
      // Tertiary sort: popularity (descending)
      return b.relevanceScore.breakdown.popularity - a.relevanceScore.breakdown.popularity;
    });
  }

  /**
   * Track search analytics for continuous improvement
   */
  public async trackSearchAnalytics(
    query: string,
    results: ScoredProduct[],
    userId?: string,
    abTestGroup?: string
  ): Promise<void> {
    try {
      const analytics = {
        query,
        timestamp: new Date().toISOString(),
        userId,
        abTestGroup,
        resultCount: results.length,
        averageScore: results.reduce((sum, p) => sum + p.relevanceScore.totalScore, 0) / results.length,
        scoreDistribution: this.calculateScoreDistribution(results),
        topBrands: this.getTopBrands(results, 5),
        topCategories: this.getTopCategories(results, 5)
      };
      
      await redis.lpush('search_analytics', JSON.stringify(analytics));
      await redis.ltrim('search_analytics', 0, 999); // Keep last 1000 searches
    } catch (error) {
      console.error('Error tracking search analytics:', error);
    }
  }

  /**
   * Calculate score distribution for analytics
   */
  private calculateScoreDistribution(results: ScoredProduct[]): Record<string, number> {
    const distribution = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
    
    results.forEach(product => {
      const score = product.relevanceScore.totalScore;
      if (score <= 25) distribution['0-25']++;
      else if (score <= 50) distribution['26-50']++;
      else if (score <= 75) distribution['51-75']++;
      else distribution['76-100']++;
    });
    
    return distribution;
  }

  /**
   * Get top brands from search results
   */
  private getTopBrands(results: ScoredProduct[], limit: number): string[] {
    const brandCounts = results.reduce((acc, product) => {
      const brand = product.brand || 'Unknown';
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(brandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([brand]) => brand);
  }

  /**
   * Get top categories from search results
   */
  private getTopCategories(results: ScoredProduct[], limit: number): string[] {
    const categoryCounts = results.reduce((acc, product) => {
      const category = product.category || 'Unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([category]) => category);
  }
}

// Export singleton instance
export const searchRelevanceService = SearchRelevanceService.getInstance(); 