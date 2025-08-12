import { NextRequest, NextResponse } from 'next/server';
import { exchangeRateService } from '@/lib/currency/exchange-rates';
import { createAPIResponse, createAPIError } from '@/lib/api-framework';
import { z } from 'zod';
import pLimit from 'p-limit';

// Validation schemas
const ConversionRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  from: z.string().length(3, 'Currency code must be 3 characters').toUpperCase(),
  to: z.string().length(3, 'Currency code must be 3 characters').toUpperCase(),
});

const ExchangeRateRequestSchema = z.object({
  base: z.string().length(3, 'Base currency must be 3 characters').toUpperCase().optional(),
  currencies: z.array(z.string().length(3)).optional(),
});

// GET /api/currency - Get exchange rates and currency information
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'rates';

    switch (action) {
      case 'rates': {
        const base = searchParams.get('base') || 'USD';
        const currenciesParam = searchParams.get('currencies');
        
        // Validate base currency
        if (!exchangeRateService.isValidCurrency(base)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            `Invalid base currency: ${base}`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        // Get exchange rates
        const rates = await exchangeRateService.getExchangeRates(base);
        
        // Filter currencies if specified
        let filteredRates = rates;
        if (currenciesParam) {
          const currencies = currenciesParam.split(',').map(c => c.toUpperCase());
          filteredRates = Object.fromEntries(
            Object.entries(rates).filter(([code]) => currencies.includes(code))
          );
        }

        const response = createAPIResponse({
          base,
          rates: filteredRates,
          status: await exchangeRateService.getExchangeRateStatus(),
        }, {
          message: 'Exchange rates retrieved successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      case 'currencies': {
        const query = searchParams.get('q');
        const region = searchParams.get('region');
        const popular = searchParams.get('popular') === 'true';

        let currencies;
        
        if (popular) {
          currencies = exchangeRateService.getPopularCurrencies();
        } else if (query) {
          currencies = exchangeRateService.searchCurrencies(query);
        } else if (region) {
          currencies = exchangeRateService.getCurrenciesByRegion(region);
        } else {
          currencies = exchangeRateService.getSupportedCurrencies();
        }

        const response = createAPIResponse({
          currencies,
          total: currencies.length,
        }, {
          message: 'Currencies retrieved successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      case 'info': {
        const currency = searchParams.get('currency')?.toUpperCase();
        
        if (!currency) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Currency parameter is required',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        const info = exchangeRateService.getCurrencyInfo(currency);
        
        if (!info) {
          const { response, statusCode } = createAPIError(
            'RESOURCE_NOT_FOUND',
            `Currency ${currency} not found`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        const response = createAPIResponse(info, {
          message: 'Currency information retrieved successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      case 'trends': {
        const from = searchParams.get('from')?.toUpperCase();
        const to = searchParams.get('to')?.toUpperCase();
        const daysParam = searchParams.get('days');
        const days = daysParam ? parseInt(daysParam) : 7;

        if (!from || !to) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Both from and to currencies are required',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        if (!exchangeRateService.isValidCurrency(from) || !exchangeRateService.isValidCurrency(to)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Invalid currency codes',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        if (days < 1 || days > 365) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Days must be between 1 and 365',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        const trends = await exchangeRateService.getCurrencyTrends(from, to, days);

        const response = createAPIResponse({
          from,
          to,
          days,
          trends,
        }, {
          message: 'Currency trends retrieved successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      case 'status': {
        const status = await exchangeRateService.getExchangeRateStatus();

        const response = createAPIResponse(status, {
          message: 'Exchange rate status retrieved successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      default: {
        const { response, statusCode } = createAPIError(
          'INVALID_REQUEST',
          `Invalid action: ${action}. Supported actions: rates, currencies, info, trends, status`,
          { requestId }
        );
        return NextResponse.json(response, { status: statusCode });
      }
    }

  } catch (error) {
    console.error('[Currency API] GET error:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Failed to process currency request',
      { requestId, details: error instanceof Error ? error.message : 'Unknown error' }
    );
    
    return NextResponse.json(response, { status: statusCode });
  }
}

// POST /api/currency - Convert currencies and perform operations
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'convert': {
        // Validate conversion request
        const validation = ConversionRequestSchema.safeParse(body);
        if (!validation.success) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Invalid conversion request',
            { 
              requestId,
              details: validation.error.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message,
              }))
            }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        const { amount, from, to } = validation.data;

        // Validate currencies
        if (!exchangeRateService.isValidCurrency(from)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            `Unsupported currency: ${from}`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        if (!exchangeRateService.isValidCurrency(to)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            `Unsupported currency: ${to}`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        // Perform conversion
        const conversion = await exchangeRateService.convertCurrency(amount, from, to);

        const response = createAPIResponse(conversion, {
          message: 'Currency conversion completed successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      case 'batch_convert': {
        const { amount, from, targets } = body;

        if (!amount || !from || !Array.isArray(targets)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Invalid batch conversion request. Required: amount, from, targets',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        if (typeof amount !== 'number' || amount <= 0) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Amount must be a positive number',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        if (!exchangeRateService.isValidCurrency(from)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            `Unsupported currency: ${from}`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        // Validate target currencies
        const validTargets = targets.filter(target => 
          typeof target === 'string' && exchangeRateService.isValidCurrency(target.toUpperCase())
        );

        if (validTargets.length === 0) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'No valid target currencies provided',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        // Perform batch conversion with concurrency control
        const limit = pLimit(5); // Limit to 5 concurrent requests
        const conversions = await Promise.all(
          validTargets.map(target => limit(async () => {
            try {
              return await exchangeRateService.convertCurrency(amount, from, target.toUpperCase());
            } catch (error) {
              return {
                from,
                to: target.toUpperCase(),
                amount,
                result: 0,
                rate: 0,
                timestamp: new Date(),
                formatted: 'Error',
                error: error instanceof Error ? error.message : 'Conversion failed',
              };
            }
          }))
        );

        const response = createAPIResponse({
          from,
          amount,
          conversions,
          successCount: conversions.filter(c => !('error' in c)).length,
          totalCount: conversions.length,
        }, {
          message: 'Batch currency conversion completed',
          requestId,
        });

        return NextResponse.json(response);
      }

      case 'refresh': {
        const { base } = body;
        const baseCurrency = base || 'USD';

        if (!exchangeRateService.isValidCurrency(baseCurrency)) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            `Invalid base currency: ${baseCurrency}`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        const success = await exchangeRateService.refreshRates(baseCurrency);

        if (success) {
          const response = createAPIResponse({
            refreshed: true,
            base: baseCurrency,
            timestamp: new Date(),
          }, {
            message: 'Exchange rates refreshed successfully',
            requestId,
          });

          return NextResponse.json(response);
        } else {
          const { response, statusCode } = createAPIError(
            'EXTERNAL_SERVICE_ERROR',
            'Failed to refresh exchange rates',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }
      }

      case 'format': {
        const { amount, currency, locale } = body;

        if (typeof amount !== 'number') {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Amount must be a number',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        if (!currency || !exchangeRateService.isValidCurrency(currency.toUpperCase())) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            `Invalid currency: ${currency}`,
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        const formatted = exchangeRateService.formatCurrency(
          amount, 
          currency.toUpperCase(), 
          locale
        );

        const response = createAPIResponse({
          amount,
          currency: currency.toUpperCase(),
          locale,
          formatted,
        }, {
          message: 'Currency formatted successfully',
          requestId,
        });

        return NextResponse.json(response);
      }

      default: {
        const { response, statusCode } = createAPIError(
          'INVALID_REQUEST',
          `Invalid action: ${action}. Supported actions: convert, batch_convert, refresh, format`,
          { requestId }
        );
        return NextResponse.json(response, { status: statusCode });
      }
    }

  } catch (error) {
    console.error('[Currency API] POST error:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Failed to process currency operation',
      { requestId, details: error instanceof Error ? error.message : 'Unknown error' }
    );
    
    return NextResponse.json(response, { status: statusCode });
  }
}

// PUT /api/currency - Update currency preferences (future implementation)
export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // This could be used for user currency preferences in the future
    const { response, statusCode } = createAPIError(
                  'SERVICE_UNAVAILABLE',
      'Currency preferences management not yet implemented',
      { requestId }
    );
    
    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error('[Currency API] PUT error:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Failed to process currency preferences request',
      { requestId, details: error instanceof Error ? error.message : 'Unknown error' }
    );
    
    return NextResponse.json(response, { status: statusCode });
  }
} 