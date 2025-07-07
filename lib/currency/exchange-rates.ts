import { redis } from '@/lib/upstash';
import * as Sentry from '@sentry/nextjs';

export interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  lastUpdated: Date;
}

export interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
  timestamp: number;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
  regions: string[];
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  timestamp: Date;
  formatted: string;
}

// Supported currencies with their information
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
    decimals: 2,
    regions: ['United States', 'Puerto Rico', 'Ecuador', 'El Salvador'],
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    decimals: 2,
    regions: ['European Union', 'Germany', 'France', 'Italy', 'Spain'],
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    flag: '🇬🇧',
    decimals: 2,
    regions: ['United Kingdom'],
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    flag: '🇯🇵',
    decimals: 0,
    regions: ['Japan'],
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    flag: '🇨🇦',
    decimals: 2,
    regions: ['Canada'],
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    flag: '🇦🇺',
    decimals: 2,
    regions: ['Australia'],
  },
  CHF: {
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF',
    flag: '🇨🇭',
    decimals: 2,
    regions: ['Switzerland', 'Liechtenstein'],
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    flag: '🇨🇳',
    decimals: 2,
    regions: ['China'],
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    flag: '🇮🇳',
    decimals: 2,
    regions: ['India'],
  },
  KRW: {
    code: 'KRW',
    name: 'South Korean Won',
    symbol: '₩',
    flag: '🇰🇷',
    decimals: 0,
    regions: ['South Korea'],
  },
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    flag: '🇸🇬',
    decimals: 2,
    regions: ['Singapore'],
  },
  HKD: {
    code: 'HKD',
    name: 'Hong Kong Dollar',
    symbol: 'HK$',
    flag: '🇭🇰',
    decimals: 2,
    regions: ['Hong Kong'],
  },
  NOK: {
    code: 'NOK',
    name: 'Norwegian Krone',
    symbol: 'kr',
    flag: '🇳🇴',
    decimals: 2,
    regions: ['Norway'],
  },
  SEK: {
    code: 'SEK',
    name: 'Swedish Krona',
    symbol: 'kr',
    flag: '🇸🇪',
    decimals: 2,
    regions: ['Sweden'],
  },
  DKK: {
    code: 'DKK',
    name: 'Danish Krone',
    symbol: 'kr',
    flag: '🇩🇰',
    decimals: 2,
    regions: ['Denmark'],
  },
  PLN: {
    code: 'PLN',
    name: 'Polish Złoty',
    symbol: 'zł',
    flag: '🇵🇱',
    decimals: 2,
    regions: ['Poland'],
  },
  CZK: {
    code: 'CZK',
    name: 'Czech Koruna',
    symbol: 'Kč',
    flag: '🇨🇿',
    decimals: 2,
    regions: ['Czech Republic'],
  },
  HUF: {
    code: 'HUF',
    name: 'Hungarian Forint',
    symbol: 'Ft',
    flag: '🇭🇺',
    decimals: 0,
    regions: ['Hungary'],
  },
  RUB: {
    code: 'RUB',
    name: 'Russian Ruble',
    symbol: '₽',
    flag: '🇷🇺',
    decimals: 2,
    regions: ['Russia'],
  },
  BRL: {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    flag: '🇧🇷',
    decimals: 2,
    regions: ['Brazil'],
  },
  MXN: {
    code: 'MXN',
    name: 'Mexican Peso',
    symbol: '$',
    flag: '🇲🇽',
    decimals: 2,
    regions: ['Mexico'],
  },
};

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private readonly CACHE_KEY = 'exchange_rates';
  private readonly CACHE_DURATION = 3600; // 1 hour in seconds
  private readonly API_ENDPOINTS = [
    'https://api.exchangerate-api.com/v4/latest/USD',
    'https://api.fixer.io/latest?access_key=YOUR_API_KEY&base=USD',
    'https://api.currencylayer.com/live?access_key=YOUR_API_KEY&source=USD',
  ];

  private constructor() {}

  public static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  /**
   * Get current exchange rates (cached or fresh)
   */
  public async getExchangeRates(baseCurrency = 'USD'): Promise<Record<string, CurrencyRate>> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedRates(baseCurrency);
      if (cached) {
        return cached;
      }

      // Fetch fresh rates
      const fresh = await this.fetchFreshRates(baseCurrency);
      
      // Cache the fresh rates
      await this.cacheRates(baseCurrency, fresh);
      
      return fresh;
    } catch (error) {
      console.error('[Currency] Error getting exchange rates:', error);
      Sentry.captureException(error);
      
      // Return fallback rates
      return this.getFallbackRates(baseCurrency);
    }
  }

  /**
   * Get cached exchange rates
   */
  private async getCachedRates(baseCurrency: string): Promise<Record<string, CurrencyRate> | null> {
    try {
      const cacheKey = `${this.CACHE_KEY}:${baseCurrency}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(String(cached));
        
        // Check if cache is still valid
        const lastUpdated = new Date(data.timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
          console.log('[Currency] Using cached exchange rates');
          return this.parseRatesData(data.rates, baseCurrency, lastUpdated);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Currency] Error getting cached rates:', error);
      return null;
    }
  }

  /**
   * Fetch fresh exchange rates from APIs
   */
  private async fetchFreshRates(baseCurrency: string): Promise<Record<string, CurrencyRate>> {
    const errors: Error[] = [];

    // Try each API endpoint
    for (const endpoint of this.API_ENDPOINTS) {
      try {
        console.log('[Currency] Fetching rates from:', endpoint);
        
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Shop-Value-App/1.0',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ExchangeRateResponse = await response.json();
        
        if (data.rates && Object.keys(data.rates).length > 0) {
          console.log('[Currency] Successfully fetched fresh rates');
          return this.parseRatesData(data.rates, baseCurrency, new Date());
        }
      } catch (error) {
        console.error(`[Currency] API ${endpoint} failed:`, error);
        errors.push(error as Error);
      }
    }

    // If all APIs failed, try the free exchangerate-api.com
    try {
      const fallbackUrl = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;
      const response = await fetch(fallbackUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.rates) {
          console.log('[Currency] Fallback API successful');
          return this.parseRatesData(data.rates, baseCurrency, new Date());
        }
      }
    } catch (error) {
      errors.push(error as Error);
    }

    throw new Error(`All currency APIs failed: ${errors.map(e => e.message).join(', ')}`);
  }

  /**
   * Parse rates data into CurrencyRate objects
   */
  private parseRatesData(
    rates: Record<string, number>,
    baseCurrency: string,
    timestamp: Date
  ): Record<string, CurrencyRate> {
    const result: Record<string, CurrencyRate> = {};

    // Add base currency
    const baseCurrencyInfo = SUPPORTED_CURRENCIES[baseCurrency];
    if (baseCurrencyInfo) {
      result[baseCurrency] = {
        code: baseCurrency,
        name: baseCurrencyInfo.name,
        symbol: baseCurrencyInfo.symbol,
        rate: 1,
        lastUpdated: timestamp,
      };
    }

    // Add other currencies
    for (const [code, rate] of Object.entries(rates)) {
      const currencyInfo = SUPPORTED_CURRENCIES[code];
      if (currencyInfo && rate > 0) {
        result[code] = {
          code,
          name: currencyInfo.name,
          symbol: currencyInfo.symbol,
          rate,
          lastUpdated: timestamp,
        };
      }
    }

    return result;
  }

  /**
   * Cache exchange rates
   */
  private async cacheRates(baseCurrency: string, rates: Record<string, CurrencyRate>): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_KEY}:${baseCurrency}`;
      const cacheData = {
        rates: Object.fromEntries(
          Object.entries(rates).map(([code, rate]) => [code, rate.rate])
        ),
        timestamp: new Date().toISOString(),
      };

      await redis.setex(cacheKey, this.CACHE_DURATION, JSON.stringify(cacheData));
      console.log('[Currency] Exchange rates cached successfully');
    } catch (error) {
      console.error('[Currency] Failed to cache rates:', error);
    }
  }

  /**
   * Get fallback rates when APIs are unavailable
   */
  private getFallbackRates(baseCurrency: string): Record<string, CurrencyRate> {
    console.log('[Currency] Using fallback exchange rates');
    
    // Static fallback rates (approximate)
    const fallbackRates: Record<string, number> = {
      USD: 1.0,
      EUR: 0.85,
      GBP: 0.73,
      JPY: 110.0,
      CAD: 1.25,
      AUD: 1.35,
      CHF: 0.92,
      CNY: 6.45,
      INR: 74.5,
      KRW: 1180.0,
      SGD: 1.35,
      HKD: 7.8,
      NOK: 8.5,
      SEK: 8.7,
      DKK: 6.3,
      PLN: 3.9,
      CZK: 21.5,
      HUF: 300.0,
      RUB: 75.0,
      BRL: 5.2,
      MXN: 20.0,
    };

    const timestamp = new Date();
    const result: Record<string, CurrencyRate> = {};

    for (const [code, rate] of Object.entries(fallbackRates)) {
      const currencyInfo = SUPPORTED_CURRENCIES[code];
      if (currencyInfo) {
        // Convert rate to be relative to base currency
        const convertedRate = baseCurrency === 'USD' ? rate : rate / fallbackRates[baseCurrency];
        
        result[code] = {
          code,
          name: currencyInfo.name,
          symbol: currencyInfo.symbol,
          rate: convertedRate,
          lastUpdated: timestamp,
        };
      }
    }

    return result;
  }

  /**
   * Convert amount between currencies
   */
  public async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ConversionResult> {
    try {
      if (amount <= 0) {
        throw new Error('Amount must be positive');
      }

      if (fromCurrency === toCurrency) {
        return {
          from: fromCurrency,
          to: toCurrency,
          amount,
          result: amount,
          rate: 1,
          timestamp: new Date(),
          formatted: this.formatCurrency(amount, toCurrency),
        };
      }

      // Get exchange rates
      const rates = await this.getExchangeRates('USD');
      
      const fromRate = rates[fromCurrency]?.rate;
      const toRate = rates[toCurrency]?.rate;

      if (!fromRate || !toRate) {
        throw new Error(`Exchange rate not available for ${fromCurrency} or ${toCurrency}`);
      }

      // Convert: amount * (toRate / fromRate)
      const conversionRate = toRate / fromRate;
      const result = amount * conversionRate;

      return {
        from: fromCurrency,
        to: toCurrency,
        amount,
        result,
        rate: conversionRate,
        timestamp: new Date(),
        formatted: this.formatCurrency(result, toCurrency),
      };
    } catch (error) {
      console.error('[Currency] Conversion failed:', error);
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Format currency amount with proper symbol and decimals
   */
  public formatCurrency(amount: number, currencyCode: string, locale?: string): string {
    const currency = SUPPORTED_CURRENCIES[currencyCode];
    if (!currency) {
      return `${amount} ${currencyCode}`;
    }

    try {
      // Use Intl.NumberFormat for proper formatting
      const formatter = new Intl.NumberFormat(locale || 'en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
      });

      return formatter.format(amount);
    } catch (error) {
      // Fallback to manual formatting
      const decimals = currency.decimals;
      const rounded = decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));
      return `${currency.symbol}${rounded.toLocaleString()}`;
    }
  }

  /**
   * Get currency information
   */
  public getCurrencyInfo(currencyCode: string): CurrencyInfo | null {
    return SUPPORTED_CURRENCIES[currencyCode] || null;
  }

  /**
   * Get all supported currencies
   */
  public getSupportedCurrencies(): CurrencyInfo[] {
    return Object.values(SUPPORTED_CURRENCIES);
  }

  /**
   * Get popular currencies for quick selection
   */
  public getPopularCurrencies(): CurrencyInfo[] {
    const popularCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
    return popularCodes
      .map(code => SUPPORTED_CURRENCIES[code])
      .filter(Boolean);
  }

  /**
   * Get currencies by region
   */
  public getCurrenciesByRegion(region: string): CurrencyInfo[] {
    return Object.values(SUPPORTED_CURRENCIES).filter(currency =>
      currency.regions.some(r => r.toLowerCase().includes(region.toLowerCase()))
    );
  }

  /**
   * Search currencies by name or code
   */
  public searchCurrencies(query: string): CurrencyInfo[] {
    const lowerQuery = query.toLowerCase();
    return Object.values(SUPPORTED_CURRENCIES).filter(currency =>
      currency.code.toLowerCase().includes(lowerQuery) ||
      currency.name.toLowerCase().includes(lowerQuery) ||
      currency.regions.some(region => region.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get historical conversion rate (if available in cache)
   */
  public async getHistoricalRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<number | null> {
    try {
      const dateKey = date.toISOString().split('T')[0];
      const cacheKey = `${this.CACHE_KEY}:historical:${dateKey}:${fromCurrency}:${toCurrency}`;
      
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === 'string') {
        return parseFloat(cached);
      }
      
      return null;
    } catch (error) {
      console.error('[Currency] Error getting historical rate:', error);
      return null;
    }
  }

  /**
   * Get currency trends (rate changes over time)
   */
  public async getCurrencyTrends(
    fromCurrency: string,
    toCurrency: string,
    days = 7
  ): Promise<Array<{ date: Date; rate: number }>> {
    try {
      const trends: Array<{ date: Date; rate: number }> = [];
      const now = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        const rate = await this.getHistoricalRate(fromCurrency, toCurrency, date);
        if (rate) {
          trends.push({ date, rate });
        }
      }
      
      return trends;
    } catch (error) {
      console.error('[Currency] Error getting currency trends:', error);
      return [];
    }
  }

  /**
   * Validate currency code
   */
  public isValidCurrency(currencyCode: string): boolean {
    return currencyCode in SUPPORTED_CURRENCIES;
  }

  /**
   * Get exchange rate status
   */
  public async getExchangeRateStatus(): Promise<{
    lastUpdated: Date | null;
    source: string;
    isStale: boolean;
    supportedCurrencies: number;
  }> {
    try {
      const rates = await this.getCachedRates('USD');
      const lastUpdated = rates ? Object.values(rates)[0]?.lastUpdated || null : null;
      const isStale = lastUpdated ? 
        (new Date().getTime() - lastUpdated.getTime()) > (2 * 60 * 60 * 1000) : true;

      return {
        lastUpdated,
        source: 'Multiple APIs with fallback',
        isStale,
        supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES).length,
      };
    } catch (error) {
      return {
        lastUpdated: null,
        source: 'Unavailable',
        isStale: true,
        supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES).length,
      };
    }
  }

  /**
   * Refresh exchange rates manually
   */
  public async refreshRates(baseCurrency = 'USD'): Promise<boolean> {
    try {
      console.log('[Currency] Manually refreshing exchange rates...');
      
      // Clear cache
      const cacheKey = `${this.CACHE_KEY}:${baseCurrency}`;
      await redis.del(cacheKey);
      
      // Fetch fresh rates
      await this.getExchangeRates(baseCurrency);
      
      return true;
    } catch (error) {
      console.error('[Currency] Failed to refresh rates:', error);
      return false;
    }
  }
}

// Export singleton instance
export const exchangeRateService = ExchangeRateService.getInstance(); 