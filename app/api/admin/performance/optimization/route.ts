import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDB } from '@/lib/mongoose';
import User from '@/lib/models/user.model';
import EnhancedPerformanceOptimizer from '@/lib/performance/enhanced-optimizer';
import { createAPIResponse, createAPIError } from '@/lib/api-framework';
import { z } from 'zod';

// Initialize the optimizer
const optimizer = EnhancedPerformanceOptimizer.getInstance();

// Validation schema for PerformanceOptimizationConfig
const performanceConfigSchema = z.object({
  enableAdaptiveCaching: z.boolean().optional(),
  enableQueryOptimization: z.boolean().optional(),
  enablePreloading: z.boolean().optional(),
  enableResourceCompression: z.boolean().optional(),
  enableCDNCaching: z.boolean().optional(),
  cacheStrategy: z.enum(['aggressive', 'balanced', 'conservative']).optional(),
  monitoringInterval: z.number().int().min(30000).max(3600000).optional(), // 30s to 1h
}).strict();

// GET /api/admin/performance/optimization - Get optimization dashboard
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check authentication and admin access
    const { userId } = auth();
    if (!userId) {
      const { response, statusCode } = createAPIError(
        'UNAUTHORIZED',
        'Authentication required',
        { requestId }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    // Check admin role with error handling
    try {
      await connectToDB();
      const user = await User.findOne({ clerkId: userId });
      if (!user || user.role !== 'admin') {
        const { response, statusCode } = createAPIError(
          'FORBIDDEN',
          'Admin access required',
          { requestId }
        );
        return NextResponse.json(response, { status: statusCode });
      }
    } catch (roleError) {
      console.error('Error checking user role:', roleError);
      const { response, statusCode } = createAPIError(
        'INTERNAL_ERROR',
        'Failed to verify admin access',
        { requestId, details: roleError instanceof Error ? roleError.message : 'Role verification failed' }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    // Get optimization dashboard data
    const dashboardData = await optimizer.getOptimizationDashboard();

    const response = createAPIResponse(dashboardData, {
      message: 'Performance optimization dashboard data retrieved successfully',
      requestId,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting optimization dashboard:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Failed to get optimization dashboard data',
      { requestId, details: error instanceof Error ? error.message : 'Unknown error' }
    );
    
    return NextResponse.json(response, { status: statusCode });
  }
}

// POST /api/admin/performance/optimization - Trigger optimization analysis
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check authentication and admin access
    const { userId } = auth();
    if (!userId) {
      const { response, statusCode } = createAPIError(
        'UNAUTHORIZED',
        'Authentication required',
        { requestId }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    // Check admin role with error handling
    try {
      await connectToDB();
      const user = await User.findOne({ clerkId: userId });
      if (!user || user.role !== 'admin') {
        const { response, statusCode } = createAPIError(
          'FORBIDDEN',
          'Admin access required',
          { requestId }
        );
        return NextResponse.json(response, { status: statusCode });
      }
    } catch (roleError) {
      console.error('Error checking user role:', roleError);
      const { response, statusCode } = createAPIError(
        'INTERNAL_ERROR',
        'Failed to verify admin access',
        { requestId, details: roleError instanceof Error ? roleError.message : 'Role verification failed' }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    const body = await request.json();
    const { action, config } = body;

    let result;

    switch (action) {
      case 'analyze':
        // Trigger performance analysis
        result = await optimizer.triggerOptimization();
        break;

      case 'configure':
        // Update optimizer configuration with validation
        if (!config) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Configuration data required',
            { requestId }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        // Validate configuration against schema
        const validation = performanceConfigSchema.safeParse(config);
        if (!validation.success) {
          const { response, statusCode } = createAPIError(
            'VALIDATION_FAILED',
            'Invalid configuration format',
            { 
              requestId,
              details: validation.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
              }))
            }
          );
          return NextResponse.json(response, { status: statusCode });
        }

        // Safely update configuration with error handling
        try {
          optimizer.updateConfig(validation.data);
          result = { 
            message: 'Configuration updated successfully',
            config: optimizer.getConfig()
          };
        } catch (updateError) {
          console.error('Error updating optimizer configuration:', updateError);
          const { response, statusCode } = createAPIError(
            'INTERNAL_ERROR',
            'Failed to update configuration',
            { 
              requestId, 
              details: updateError instanceof Error ? updateError.message : 'Configuration update failed' 
            }
          );
          return NextResponse.json(response, { status: statusCode });
        }
        break;

      case 'initialize':
        // Initialize the optimizer
        await optimizer.initialize();
        result = { message: 'Optimizer initialized successfully' };
        break;

      default:
        const { response, statusCode } = createAPIError(
          'INVALID_REQUEST',
          'Invalid action. Supported actions: analyze, configure, initialize',
          { requestId }
        );
        return NextResponse.json(response, { status: statusCode });
    }

    const response = createAPIResponse(result, {
      message: `Performance optimization ${action} completed successfully`,
      requestId,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in performance optimization action:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Performance optimization action failed',
      { requestId, details: error instanceof Error ? error.message : 'Unknown error' }
    );
    
    return NextResponse.json(response, { status: statusCode });
  }
}

// PUT /api/admin/performance/optimization - Update optimization settings
export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check authentication and admin access
    const { userId } = auth();
    if (!userId) {
      const { response, statusCode } = createAPIError(
        'UNAUTHORIZED',
        'Authentication required',
        { requestId }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    // Check admin role with error handling
    try {
      await connectToDB();
      const user = await User.findOne({ clerkId: userId });
      if (!user || user.role !== 'admin') {
        const { response, statusCode } = createAPIError(
          'FORBIDDEN',
          'Admin access required',
          { requestId }
        );
        return NextResponse.json(response, { status: statusCode });
      }
    } catch (roleError) {
      console.error('Error checking user role:', roleError);
      const { response, statusCode } = createAPIError(
        'INTERNAL_ERROR',
        'Failed to verify admin access',
        { requestId, details: roleError instanceof Error ? roleError.message : 'Role verification failed' }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    const config = await request.json();
    
    // Validate configuration
    const validConfigKeys = [
      'enableAdaptiveCaching',
      'enableQueryOptimization', 
      'enablePreloading',
      'enableResourceCompression',
      'enableCDNCaching',
      'cacheStrategy',
      'monitoringInterval'
    ];

    const invalidKeys = Object.keys(config).filter(key => !validConfigKeys.includes(key));
    if (invalidKeys.length > 0) {
      const { response, statusCode } = createAPIError(
        'VALIDATION_FAILED',
        `Invalid configuration keys: ${invalidKeys.join(', ')}`,
        { requestId }
      );
      return NextResponse.json(response, { status: statusCode });
    }

    // Update configuration
    optimizer.updateConfig(config);
    
    const response = createAPIResponse({
      updatedConfig: optimizer.getConfig(),
      message: 'Performance optimization configuration updated successfully'
    }, {
      requestId,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error updating optimization configuration:', error);
    
    const { response, statusCode } = createAPIError(
      'INTERNAL_ERROR',
      'Failed to update optimization configuration',
      { requestId, details: error instanceof Error ? error.message : 'Unknown error' }
    );
    
    return NextResponse.json(response, { status: statusCode });
  }
} 