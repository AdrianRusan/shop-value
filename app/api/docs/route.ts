import { NextRequest, NextResponse } from 'next/server';
import { createAPIResponse } from '@/lib/api-framework';

// Force this API route to be dynamic
export const dynamic = 'force-dynamic';

// Complete OpenAPI specification for the Shop Value API
const openAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'Shop Value API',
    description: 'Comprehensive API for the Shop Value shopping assistant platform. Track prices, manage alerts, convert currencies, and access powerful analytics.',
    version: '1.0.0',
    contact: {
      name: 'Shop Value API Support',
      email: 'api-support@shopvalue.com',
      url: 'https://shopvalue.com/support'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    },
    termsOfService: 'https://shopvalue.com/terms'
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  paths: {
    '/api/products/search': {
      get: {
        tags: ['Products'],
        summary: 'Search for products',
        description: 'Search for products across multiple retailers with filtering, sorting, and relevance scoring.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Search query for products',
            required: true,
            schema: { type: 'string', example: 'wireless headphones' }
          },
          {
            name: 'category',
            in: 'query',
            description: 'Product category filter',
            schema: { type: 'string', example: 'electronics' }
          },
          {
            name: 'min_price',
            in: 'query',
            description: 'Minimum price filter',
            schema: { type: 'number', minimum: 0, example: 50 }
          },
          {
            name: 'max_price',
            in: 'query',
            description: 'Maximum price filter',
            schema: { type: 'number', minimum: 0, example: 500 }
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Sort order for results',
            schema: { 
              type: 'string', 
              enum: ['relevance', 'price_asc', 'price_desc', 'rating'],
              default: 'relevance'
            }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results to return',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'page',
            in: 'query',
            description: 'Page number for pagination',
            schema: { type: 'integer', minimum: 1, default: 1 }
          }
        ],
        responses: {
          200: {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductSearchResponse' },
                example: {
                  success: true,
                  data: {
                    products: [
                      {
                        id: 'prod_123',
                        name: 'Sony WH-1000XM4 Wireless Headphones',
                        price: 349.99,
                        currency: 'USD',
                        retailer: 'Amazon',
                        image: 'https://example.com/image.jpg',
                        rating: 4.5,
                        reviews: 1250,
                        url: 'https://amazon.com/dp/B0863TXGM3'
                      }
                    ],
                    pagination: {
                      page: 1,
                      limit: 20,
                      total: 150,
                      totalPages: 8
                    },
                    searchMeta: {
                      query: 'wireless headphones',
                      executionTime: 0.234,
                      resultsFound: 150
                    }
                  },
                  meta: {
                    requestId: 'req_abc123',
                    timestamp: '2024-01-15T10:30:00Z'
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimitError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/api/alerts': {
      get: {
        tags: ['Price Alerts'],
        summary: 'Get user price alerts',
        description: 'Retrieve all price alerts for the authenticated user with filtering and sorting options.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            description: 'Filter by alert status',
            schema: { 
              type: 'string', 
              enum: ['active', 'triggered', 'paused', 'expired']
            }
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Sort order',
            schema: { 
              type: 'string', 
              enum: ['created_desc', 'created_asc', 'price_asc', 'price_desc'],
              default: 'created_desc'
            }
          }
        ],
        responses: {
          200: {
            description: 'List of price alerts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AlertListResponse' },
                example: {
                  success: true,
                  data: {
                    alerts: [
                      {
                        id: 'alert_456',
                        productId: 'prod_123',
                        productName: 'Sony WH-1000XM4',
                        currentPrice: 349.99,
                        targetPrice: 299.99,
                        status: 'active',
                        createdAt: '2024-01-15T09:00:00Z',
                        triggeredAt: null
                      }
                    ],
                    total: 5
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      },
      post: {
        tags: ['Price Alerts'],
        summary: 'Create price alert',
        description: 'Create a new price alert for a specific product and target price.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAlertRequest' },
              example: {
                productId: 'prod_123',
                targetPrice: 299.99,
                currency: 'USD',
                notificationMethods: ['email', 'push']
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Alert created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AlertResponse' }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          403: { $ref: '#/components/responses/SubscriptionLimitError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/api/currency': {
      get: {
        tags: ['Currency'],
        summary: 'Get exchange rates and currency information',
        description: 'Retrieve current exchange rates, currency information, trends, and status.',
        parameters: [
          {
            name: 'action',
            in: 'query',
            description: 'Type of currency operation',
            required: true,
            schema: {
              type: 'string',
              enum: ['rates', 'currencies', 'info', 'trends', 'status']
            }
          },
          {
            name: 'base',
            in: 'query',
            description: 'Base currency for exchange rates',
            schema: { type: 'string', example: 'USD' }
          },
          {
            name: 'currencies',
            in: 'query',
            description: 'Comma-separated list of target currencies',
            schema: { type: 'string', example: 'EUR,GBP,JPY' }
          }
        ],
        responses: {
          200: {
            description: 'Currency data retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CurrencyResponse' }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      },
      post: {
        tags: ['Currency'],
        summary: 'Convert currencies and perform operations',
        description: 'Convert between currencies, batch convert, refresh rates, or format currency amounts.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CurrencyOperationRequest' },
              examples: {
                convert: {
                  summary: 'Convert currency',
                  value: {
                    action: 'convert',
                    amount: 100,
                    from: 'USD',
                    to: 'EUR'
                  }
                },
                batchConvert: {
                  summary: 'Batch convert to multiple currencies',
                  value: {
                    action: 'batch_convert',
                    amount: 100,
                    from: 'USD',
                    targets: ['EUR', 'GBP', 'JPY']
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Operation completed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CurrencyOperationResponse' }
              }
            }
          },
          400: { $ref: '#/components/responses/ValidationError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/api/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Get dashboard analytics',
        description: 'Retrieve comprehensive analytics data for the user dashboard including savings, alerts, and usage statistics.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            description: 'Time period for analytics',
            schema: {
              type: 'string',
              enum: ['7d', '30d', '90d', '1y'],
              default: '30d'
            }
          }
        ],
        responses: {
          200: {
            description: 'Dashboard analytics data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardAnalyticsResponse' }
              }
            }
          },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/api/subscription': {
      get: {
        tags: ['Subscription'],
        summary: 'Get subscription status',
        description: 'Retrieve current subscription information, usage limits, and billing details.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Subscription information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionResponse' }
              }
            }
          },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalError' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from Clerk authentication'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for server-to-server authentication'
      }
    },
    schemas: {
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique product identifier' },
          name: { type: 'string', description: 'Product name' },
          price: { type: 'number', description: 'Current price' },
          currency: { type: 'string', description: 'Price currency code' },
          retailer: { type: 'string', description: 'Retailer name' },
          image: { type: 'string', format: 'uri', description: 'Product image URL' },
          rating: { type: 'number', minimum: 0, maximum: 5, description: 'Average rating' },
          reviews: { type: 'integer', description: 'Number of reviews' },
          url: { type: 'string', format: 'uri', description: 'Product page URL' },
          category: { type: 'string', description: 'Product category' },
          brand: { type: 'string', description: 'Product brand' },
          description: { type: 'string', description: 'Product description' },
          specifications: {
            type: 'object',
            additionalProperties: true,
            description: 'Product specifications'
          },
          availability: {
            type: 'string',
            enum: ['in_stock', 'out_of_stock', 'limited', 'preorder']
          },
          priceHistory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                price: { type: 'number' },
                date: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['id', 'name', 'price', 'currency', 'retailer']
      },
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Alert ID' },
          userId: { type: 'string', description: 'User ID' },
          productId: { type: 'string', description: 'Product ID' },
          productName: { type: 'string', description: 'Product name' },
          currentPrice: { type: 'number', description: 'Current product price' },
          targetPrice: { type: 'number', description: 'Target price for alert' },
          currency: { type: 'string', description: 'Price currency' },
          status: {
            type: 'string',
            enum: ['active', 'triggered', 'paused', 'expired']
          },
          notificationMethods: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'push', 'sms', 'webhook']
            }
          },
          createdAt: { type: 'string', format: 'date-time' },
          triggeredAt: { type: 'string', format: 'date-time', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true }
        },
        required: ['id', 'userId', 'productId', 'targetPrice', 'status']
      },
      CurrencyInfo: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Currency code (ISO 4217)' },
          name: { type: 'string', description: 'Currency name' },
          symbol: { type: 'string', description: 'Currency symbol' },
          flag: { type: 'string', description: 'Country flag emoji' },
          decimals: { type: 'integer', description: 'Number of decimal places' },
          regions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Regions where currency is used'
          }
        },
        required: ['code', 'name', 'symbol']
      },
      ExchangeRate: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Currency code' },
          name: { type: 'string', description: 'Currency name' },
          symbol: { type: 'string', description: 'Currency symbol' },
          rate: { type: 'number', description: 'Exchange rate' },
          lastUpdated: { type: 'string', format: 'date-time' }
        }
      },
      ProductSearchResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: { $ref: '#/components/schemas/Product' }
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' }
                }
              },
              searchMeta: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  executionTime: { type: 'number' },
                  resultsFound: { type: 'integer' }
                }
              }
            }
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      AlertListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              alerts: {
                type: 'array',
                items: { $ref: '#/components/schemas/Alert' }
              },
              total: { type: 'integer' }
            }
          }
        }
      },
      AlertResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/Alert' }
        }
      },
      CreateAlertRequest: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID to track' },
          targetPrice: { type: 'number', minimum: 0, description: 'Target price' },
          currency: { type: 'string', description: 'Price currency' },
          notificationMethods: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'push', 'sms', 'webhook']
            },
            default: ['email']
          },
          expiresAt: { type: 'string', format: 'date-time', description: 'Optional expiration date' }
        },
        required: ['productId', 'targetPrice']
      },
      CurrencyResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  base: { type: 'string' },
                  rates: {
                    type: 'object',
                    additionalProperties: { $ref: '#/components/schemas/ExchangeRate' }
                  },
                  status: {
                    type: 'object',
                    properties: {
                      lastUpdated: { type: 'string', format: 'date-time' },
                      source: { type: 'string' },
                      isStale: { type: 'boolean' }
                    }
                  }
                }
              },
              {
                type: 'object',
                properties: {
                  currencies: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CurrencyInfo' }
                  },
                  total: { type: 'integer' }
                }
              }
            ]
          }
        }
      },
      CurrencyOperationRequest: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['convert', 'batch_convert', 'refresh', 'format']
          },
          amount: { type: 'number', minimum: 0 },
          from: { type: 'string' },
          to: { type: 'string' },
          targets: {
            type: 'array',
            items: { type: 'string' }
          },
          currency: { type: 'string' },
          locale: { type: 'string' }
        },
        required: ['action']
      },
      CurrencyOperationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  amount: { type: 'number' },
                  result: { type: 'number' },
                  rate: { type: 'number' },
                  formatted: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' }
                }
              },
              {
                type: 'object',
                properties: {
                  conversions: { type: 'array' },
                  successCount: { type: 'integer' },
                  totalCount: { type: 'integer' }
                }
              }
            ]
          }
        }
      },
      DashboardAnalyticsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              totalSavings: { type: 'number' },
              activeAlerts: { type: 'integer' },
              triggeredAlerts: { type: 'integer' },
              productsTracked: { type: 'integer' },
              averageSavingPercentage: { type: 'number' },
              topCategories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    count: { type: 'integer' },
                    savings: { type: 'number' }
                  }
                }
              },
              savingsOverTime: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string', format: 'date' },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      SubscriptionResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              plan: {
                type: 'string',
                enum: ['free', 'basic', 'premium']
              },
              status: {
                type: 'string',
                enum: ['active', 'trialing', 'past_due', 'canceled']
              },
              limits: {
                type: 'object',
                properties: {
                  alerts: { type: 'integer' },
                  searches: { type: 'integer' },
                  apiCalls: { type: 'integer' }
                }
              },
              usage: {
                type: 'object',
                properties: {
                  alerts: { type: 'integer' },
                  searches: { type: 'integer' },
                  apiCalls: { type: 'integer' }
                }
              },
              billingCycle: { type: 'string' },
              nextBillingDate: { type: 'string', format: 'date' }
            }
          }
        }
      },
      APIError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' }
            }
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/APIError' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_FAILED',
                message: 'Request validation failed',
                details: {
                  field: 'amount',
                  reason: 'Must be a positive number'
                }
              },
              meta: {
                requestId: 'req_123',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      },
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/APIError' },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
              }
            }
          }
        }
      },
      SubscriptionLimitError: {
        description: 'Subscription limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/APIError' },
            example: {
              success: false,
              error: {
                code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
                message: 'You have reached your plan limit for price alerts'
              }
            }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/APIError' },
            example: {
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Rate limit exceeded. Try again later.'
              }
            }
          }
        }
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/APIError' },
            example: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'An internal error occurred'
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Products',
      description: 'Product search and management operations'
    },
    {
      name: 'Price Alerts',
      description: 'Price alert management and notifications'
    },
    {
      name: 'Currency',
      description: 'Currency conversion and exchange rate operations'
    },
    {
      name: 'Analytics',
      description: 'User analytics and dashboard data'
    },
    {
      name: 'Subscription',
      description: 'Subscription and billing management'
    }
  ]
};

// GET /api/docs - Return OpenAPI specification
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // Remove request.url usage to make this route statically generatable
    const url = new URL(request.nextUrl.href);
    const format = url.searchParams.get('format') || 'json';

    if (format === 'yaml') {
      // Convert to YAML format (simplified)
      const yamlContent = JSON.stringify(openAPISpec, null, 2)
        .replace(/"/g, '')
        .replace(/,$/gm, '')
        .replace(/{/g, '')
        .replace(/}/g, '');
      
      return new Response(yamlContent, {
        headers: {
          'Content-Type': 'application/x-yaml',
          'Content-Disposition': 'attachment; filename="shop-value-api.yaml"'
        }
      });
    }

    const response = createAPIResponse(openAPISpec, {
      message: 'OpenAPI specification retrieved successfully',
      requestId,
    });

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('[API Docs] Error generating documentation:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate API documentation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
} 