import { NextRequest, NextResponse } from 'next/server';
import { checkDBHealth, getDBStats } from '@/lib/mongoose';
import { generateOptimizationReport } from '@/lib/database/optimization';

// GET /api/admin/database/health - Database health monitoring endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    
    if (detailed) {
      // Get comprehensive optimization report
      const report = await generateOptimizationReport();
      
      return NextResponse.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    } else {
      // Get basic health check
      const [health, stats] = await Promise.all([
        checkDBHealth(),
        getDBStats()
      ]);
      
      return NextResponse.json({
        success: true,
        data: {
          health,
          stats
        },
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST /api/admin/database/health - Database optimization actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'optimize':
        const { createProductionIndexes, cleanupOldData } = await import('@/lib/database/optimization');
        
        const [indexResult, cleanupResult] = await Promise.all([
          createProductionIndexes(),
          cleanupOldData()
        ]);
        
        return NextResponse.json({
          success: true,
          data: {
            indexes: 'created',
            cleanup: cleanupResult
          },
          message: 'Database optimization completed',
          timestamp: new Date().toISOString()
        });
        
      case 'audit':
        const { auditIndexes } = await import('@/lib/database/optimization');
        const auditResult = await auditIndexes();
        
        return NextResponse.json({
          success: true,
          data: auditResult,
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: optimize, audit'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Database optimization action failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database optimization action failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}