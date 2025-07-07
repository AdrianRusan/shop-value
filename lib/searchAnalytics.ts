/**
 * Search Analytics Service
 * Comprehensive tracking system for search behavior, queries, and performance metrics
 */

import analytics from './analytics';
import { connectToDatabase } from './mongoose';
import Analytics from './models/analytics.model';

// Optional Sentry import - handle gracefully if not available
let Sentry: any = null;
if (typeof window === 'undefined') {
  // Server-side only
  try {
    Sentry = eval('require')('@sentry/nextjs');
  } catch (error) {
    // Sentry not available - continue without it
  }
}

export interface SearchQuery {
  query: string;
  filters?: {
    priceRange?: [number, number];
    brands?: string[];
    categories?: string[];
    availability?: string[];
    discount?: [number, number];
    sortBy?: string;
  };
  results?: {
    count: number;
    products: string[];
    responseTime: number;
  };
  user?: {
    id?: string;
    sessionId: string;
    userAgent?: string;
    ipAddress?: string;
  };
  timestamp?: Date;
}

export interface SearchResult {
  productId: string;
  position: number;
  clicked: boolean;
  timestamp: Date;
}

export interface SearchSession {
  sessionId: string;
  userId?: string;
  queries: SearchQuery[];
  results: SearchResult[];
  conversions: string[];
  duration: number;
  timestamp: Date;
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  clickThroughRate: number;
  conversionRate: number;
  popularQueries: Array<{ query: string; count: number }>;
  popularFilters: Array<{ filter: string; count: number }>;
  noResultsQueries: Array<{ query: string; count: number }>;
}

class SearchAnalyticsService {
  private readonly isDevelopment = typeof window === 'undefined' && 
    typeof globalThis !== 'undefined' && 
    (globalThis as any).process?.env?.NODE_ENV === 'development';

  /**
   * Track a search query with comprehensive metadata
   */
  async trackSearchQuery(searchData: SearchQuery): Promise<void> {
    try {
      const {
        query,
        filters = {},
        results,
        user = { sessionId: 'anonymous' },
        timestamp = new Date()
      } = searchData;

      // Track in main analytics system
      await analytics.track('search_performed', {
        query,
        filters: JSON.stringify(filters),
        resultCount: results?.count || 0,
        responseTime: results?.responseTime || 0,
        hasResults: (results?.count || 0) > 0,
        userId: user.id,
        sessionId: user.sessionId,
        timestamp: timestamp.toISOString(),
        userAgent: user.userAgent,
        ipAddress: user.ipAddress
      });

      // Store detailed search data in MongoDB
      await this.storeSearchData(searchData);

      // Track popular queries
      await this.updatePopularQueries(query);

      // Track filter usage
      await this.trackFilterUsage(filters);

      if (this.isDevelopment) {
        console.log('Search query tracked:', { query, filters, results: results?.count });
      }
    } catch (error) {
      console.error('Failed to track search query:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }

  /**
   * Track search result clicks
   */
  async trackResultClick(data: {
    query: string;
    productId: string;
    position: number;
    sessionId: string;
    userId?: string;
    filters?: any;
  }): Promise<void> {
    try {
      const { query, productId, position, sessionId, userId, filters } = data;

      // Track in main analytics system
      await analytics.track('search_result_clicked', {
        query,
        productId,
        position,
        sessionId,
        userId,
        filters: JSON.stringify(filters || {}),
        timestamp: new Date().toISOString()
      });

      // Update click-through rate calculations
      await this.updateClickThroughRate(query, productId, position);

      if (this.isDevelopment) {
        console.log('Search result click tracked:', { query, productId, position });
      }
    } catch (error) {
      console.error('Failed to track result click:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }

  /**
   * Track search conversions (when user tracks a product from search)
   */
  async trackSearchConversion(data: {
    query: string;
    productId: string;
    sessionId: string;
    userId?: string;
    conversionType: 'track' | 'alert' | 'share';
  }): Promise<void> {
    try {
      const { query, productId, sessionId, userId, conversionType } = data;

      // Track in main analytics system
      await analytics.track('search_conversion', {
        query,
        productId,
        sessionId,
        userId,
        conversionType,
        timestamp: new Date().toISOString()
      });

      // Update conversion rate calculations
      await this.updateConversionRate(query, conversionType);

      if (this.isDevelopment) {
        console.log('Search conversion tracked:', { query, productId, conversionType });
      }
    } catch (error) {
      console.error('Failed to track search conversion:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }

  /**
   * Track search performance metrics
   */
  async trackSearchPerformance(data: {
    query: string;
    responseTime: number;
    resultCount: number;
    cacheHit: boolean;
    errorOccurred: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const { query, responseTime, resultCount, cacheHit, errorOccurred, errorMessage } = data;

      // Track in main analytics system
      await analytics.track('search_performance', {
        query,
        responseTime,
        resultCount,
        cacheHit,
        errorOccurred,
        errorMessage,
        timestamp: new Date().toISOString()
      });

      // Update performance metrics
      await this.updatePerformanceMetrics(responseTime, resultCount, errorOccurred);

      if (this.isDevelopment) {
        console.log('Search performance tracked:', { query, responseTime, resultCount });
      }
    } catch (error) {
      console.error('Failed to track search performance:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
    }
  }

  /**
   * Get search analytics metrics for a date range
   */
  async getSearchMetrics(dateRange: {
    start: Date;
    end: Date;
  }): Promise<SearchMetrics> {
    try {
      await connectToDatabase();

      // Use the Analytics model with proper MongoDB aggregation
      const AnalyticsModel = Analytics as any;
      const results = await AnalyticsModel.aggregate([
        {
          $match: {
            tenantId: 'default',
            'events.timestamp': {
              $gte: dateRange.start,
              $lte: dateRange.end
            }
          }
        },
        {
          $unwind: '$events'
        },
        {
          $match: {
            'events.event': { $in: ['search_performed', 'search_result_clicked', 'search_conversion'] },
            'events.timestamp': {
              $gte: dateRange.start,
              $lte: dateRange.end
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSearches: {
              $sum: { $cond: [{ $eq: ['$events.event', 'search_performed'] }, 1, 0] }
            },
            totalClicks: {
              $sum: { $cond: [{ $eq: ['$events.event', 'search_result_clicked'] }, 1, 0] }
            },
            totalConversions: {
              $sum: { $cond: [{ $eq: ['$events.event', 'search_conversion'] }, 1, 0] }
            },
            uniqueUsers: {
              $addToSet: '$events.properties.userId'
            },
            averageResponseTime: {
              $avg: {
                $cond: [
                  { $and: [
                    { $eq: ['$events.event', 'search_performed'] },
                    { $gt: ['$events.properties.responseTime', 0] }
                  ]},
                  '$events.properties.responseTime',
                  null
                ]
              }
            },
            popularQueries: {
              $push: {
                $cond: [
                  { $eq: ['$events.event', 'search_performed'] },
                  '$events.properties.query',
                  null
                ]
              }
            },
            noResultsQueries: {
              $push: {
                $cond: [
                  { $and: [
                    { $eq: ['$events.event', 'search_performed'] },
                    { $eq: ['$events.properties.hasResults', false] }
                  ]},
                  '$events.properties.query',
                  null
                ]
              }
            }
          }
        },
        {
          $project: {
            totalSearches: 1,
            totalClicks: 1,
            totalConversions: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            averageResponseTime: { $round: ['$averageResponseTime', 2] },
            clickThroughRate: {
              $round: [
                { $multiply: [{ $divide: ['$totalClicks', '$totalSearches'] }, 100] },
                2
              ]
            },
            conversionRate: {
              $round: [
                { $multiply: [{ $divide: ['$totalConversions', '$totalSearches'] }, 100] },
                2
              ]
            },
            popularQueries: 1,
            noResultsQueries: 1
          }
        }
      ]);

      const metrics = results[0] || {
        totalSearches: 0,
        uniqueUsers: 0,
        averageResponseTime: 0,
        clickThroughRate: 0,
        conversionRate: 0,
        popularQueries: [],
        noResultsQueries: []
      };

      // Process popular queries
      const queryFrequency = this.calculateQueryFrequency(metrics.popularQueries);
      const noResultsFrequency = this.calculateQueryFrequency(metrics.noResultsQueries);

      return {
        totalSearches: metrics.totalSearches,
        uniqueUsers: metrics.uniqueUsers,
        averageResponseTime: metrics.averageResponseTime,
        clickThroughRate: metrics.clickThroughRate,
        conversionRate: metrics.conversionRate,
        popularQueries: queryFrequency,
        popularFilters: await this.getPopularFilters(dateRange),
        noResultsQueries: noResultsFrequency
      };
    } catch (error) {
      console.error('Failed to get search metrics:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
      throw error;
    }
  }

  /**
   * Get search insights for optimization
   */
  async getSearchInsights(dateRange: {
    start: Date;
    end: Date;
  }): Promise<{
    lowPerformingQueries: Array<{ query: string; avgResponseTime: number }>;
    highBounceRateQueries: Array<{ query: string; bounceRate: number }>;
    conversionOpportunities: Array<{ query: string; clicks: number; conversions: number }>;
    suggestions: string[];
  }> {
    try {
      await connectToDatabase();

      // Get low performing queries (high response time)
      const AnalyticsModel = Analytics as any;
      const lowPerformingQueries = await AnalyticsModel.aggregate([
        {
          $match: {
            tenantId: 'default',
            'events.event': 'search_performed',
            'events.timestamp': {
              $gte: dateRange.start,
              $lte: dateRange.end
            }
          }
        },
        {
          $unwind: '$events'
        },
        {
          $match: {
            'events.event': 'search_performed',
            'events.properties.responseTime': { $gt: 0 }
          }
        },
        {
          $group: {
            _id: '$events.properties.query',
            avgResponseTime: { $avg: '$events.properties.responseTime' },
            searchCount: { $sum: 1 }
          }
        },
        {
          $match: {
            avgResponseTime: { $gt: 1000 }, // Slower than 1 second
            searchCount: { $gt: 5 } // At least 5 searches
          }
        },
        {
          $sort: { avgResponseTime: -1 }
        },
        {
          $limit: 10
        },
        {
          $project: {
            query: '$_id',
            avgResponseTime: { $round: ['$avgResponseTime', 2] },
            _id: 0
          }
        }
      ]);

      // Generate optimization suggestions
      const suggestions = [
        'Consider adding more specific filters to reduce search scope',
        'Implement search result caching for popular queries',
        'Add spelling correction for queries with no results',
        'Consider adding auto-complete suggestions for better user experience',
        'Implement search result ranking based on user behavior'
      ];

      return {
        lowPerformingQueries,
        highBounceRateQueries: [], // Implement if needed
        conversionOpportunities: [], // Implement if needed
        suggestions
      };
    } catch (error) {
      console.error('Failed to get search insights:', error);
      if (Sentry?.captureException) {
        Sentry.captureException(error);
      }
      throw error;
    }
  }

  /**
   * Store detailed search data in MongoDB
   */
  private async storeSearchData(searchData: SearchQuery): Promise<void> {
    try {
      await connectToDatabase();

      const AnalyticsModel = Analytics as any;
      await AnalyticsModel.findOneAndUpdate(
        { tenantId: 'default' },
        {
          $push: {
            events: {
              sessionId: searchData.user?.sessionId || 'anonymous',
              event: 'search_performed',
              properties: {
                query: searchData.query,
                filters: searchData.filters,
                resultCount: searchData.results?.count || 0,
                responseTime: searchData.results?.responseTime || 0,
                hasResults: (searchData.results?.count || 0) > 0,
                userId: searchData.user?.id,
                userAgent: searchData.user?.userAgent,
                ipAddress: searchData.user?.ipAddress
              },
              timestamp: searchData.timestamp || new Date()
            }
          }
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('Failed to store search data:', error);
      // Don't throw to avoid breaking search functionality
    }
  }

  /**
   * Update popular queries tracking
   */
  private async updatePopularQueries(query: string): Promise<void> {
    try {
      await connectToDatabase();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const AnalyticsModel = Analytics as any;
      await AnalyticsModel.findOneAndUpdate(
        { tenantId: 'default' },
        {
          $inc: {
            [`aggregatedData.daily.${today.toISOString().split('T')[0]}.queries.${query}`]: 1
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Failed to update popular queries:', error);
    }
  }

  /**
   * Track filter usage patterns
   */
  private async trackFilterUsage(filters: any): Promise<void> {
    try {
      const filterKeys = Object.keys(filters);
      for (const filterKey of filterKeys) {
        await analytics.track('filter_applied', {
          filterType: filterKey,
          filterValue: JSON.stringify(filters[filterKey]),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to track filter usage:', error);
    }
  }

  /**
   * Update click-through rate calculations
   */
  private async updateClickThroughRate(query: string, productId: string, position: number): Promise<void> {
    // Implementation for CTR tracking
    // Store in aggregated data for performance
  }

  /**
   * Update conversion rate calculations
   */
  private async updateConversionRate(query: string, conversionType: string): Promise<void> {
    // Implementation for conversion rate tracking
    // Store in aggregated data for performance
  }

  /**
   * Update performance metrics
   */
  private async updatePerformanceMetrics(responseTime: number, resultCount: number, errorOccurred: boolean): Promise<void> {
    // Implementation for performance metrics tracking
    // Store in aggregated data for performance
  }

  /**
   * Calculate query frequency from array
   */
  private calculateQueryFrequency(queries: string[]): Array<{ query: string; count: number }> {
    const frequency: { [key: string]: number } = {};
    
    queries.filter(q => q).forEach(query => {
      frequency[query] = (frequency[query] || 0) + 1;
    });

    return Object.entries(frequency)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get popular filters for date range
   */
  private async getPopularFilters(dateRange: { start: Date; end: Date }): Promise<Array<{ filter: string; count: number }>> {
    try {
      await connectToDatabase();

      const AnalyticsModel = Analytics as any;
      const results = await AnalyticsModel.aggregate([
        {
          $match: {
            tenantId: 'default',
            'events.event': 'filter_applied',
            'events.timestamp': {
              $gte: dateRange.start,
              $lte: dateRange.end
            }
          }
        },
        {
          $unwind: '$events'
        },
        {
          $match: {
            'events.event': 'filter_applied'
          }
        },
        {
          $group: {
            _id: '$events.properties.filterType',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        },
        {
          $project: {
            filter: '$_id',
            count: 1,
            _id: 0
          }
        }
      ]);

      return results;
    } catch (error) {
      console.error('Failed to get popular filters:', error);
      return [];
    }
  }
}

// Export singleton instance
export const searchAnalytics = new SearchAnalyticsService();
export default searchAnalytics;