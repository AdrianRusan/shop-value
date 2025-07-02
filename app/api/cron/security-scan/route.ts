import { NextRequest, NextResponse } from 'next/server';
import { createSecurityScanner } from '@/lib/security-scanner';
import { createSecurityAuditor } from '@/lib/security-audit';
import * as Sentry from '@sentry/nextjs';
import { redis } from '@/lib/upstash';

// Verify this is a legitimate cron job request
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In production, verify the authorization header
  if (process.env.NODE_ENV === 'production') {
    if (!authHeader || !cronSecret) {
      return false;
    }
    
    // Check if the request is from Vercel cron or has valid secret
    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isValidSecret = authHeader === `Bearer ${process.env.SECURITY_SCAN_SECRET}`;
    
    return isVercelCron || isValidSecret;
  }
  
  // Allow in development/test environments
  return true;
}

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(request)) {
      console.error('Unauthorized cron request');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('🔐 Starting scheduled security scan...');
    const startTime = Date.now();

    // Check if a scan is already running
    const scanInProgress = await redis.get('security:scan:in_progress');
    if (scanInProgress) {
      console.log('Security scan already in progress, skipping...');
      return NextResponse.json({
        success: true,
        message: 'Security scan already in progress',
        skipped: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Mark scan as in progress
    await redis.setex('security:scan:in_progress', 300, 'true'); // 5 minutes timeout

    try {
      // Run comprehensive security audit
      const auditor = createSecurityAuditor();
      const auditResult = await auditor.performFullAudit();

      // Run automated security scan
      const scanner = createSecurityScanner();
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shopvalue.vercel.app';
      const scanResult = await scanner.runSecurityScan(baseUrl);

      const duration = Date.now() - startTime;

      // Calculate combined security score
      const combinedScore = Math.round((
        (100 - auditResult.risk_score) * 0.7 + // Audit contributes 70%
        (scanResult.vulnerabilities.length === 0 ? 100 : Math.max(0, 100 - scanResult.vulnerabilities.length * 10)) * 0.3 // Scan contributes 30%
      ));

      // Store combined results
      const combinedResult = {
        scan_id: `combined_${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        audit: {
          risk_score: auditResult.risk_score,
          vulnerabilities: auditResult.vulnerabilities.length,
          compliance: auditResult.compliance_status,
        },
        scan: {
          target: scanResult.target,
          vulnerabilities: scanResult.vulnerabilities.length,
          coverage: scanResult.coverage,
        },
        combined_security_score: combinedScore,
        total_vulnerabilities: auditResult.vulnerabilities.length + scanResult.vulnerabilities.length,
                 critical_issues: [
           ...auditResult.vulnerabilities.filter((v: any) => v.severity === 'critical'),
           ...scanResult.vulnerabilities.filter((v: any) => v.severity === 'critical')
         ].length,
      };

      // Store in Redis for monitoring
      await redis.setex('security:combined:latest', 24 * 60 * 60, JSON.stringify(combinedResult));
      await redis.incr('security:cron:runs');

      // Send alerts if critical issues found
      if (combinedResult.critical_issues > 0 || combinedScore < 50) {
        await sendSecurityAlert(combinedResult);
      }

      console.log(`✅ Scheduled security scan completed in ${duration}ms`);
      console.log(`🎯 Combined Security Score: ${combinedScore}/100`);
      console.log(`⚠️ Total Vulnerabilities: ${combinedResult.total_vulnerabilities}`);

      return NextResponse.json({
        success: true,
        message: 'Scheduled security scan completed',
        data: combinedResult,
        timestamp: new Date().toISOString(),
      });

    } finally {
      // Clear the in-progress flag
      await redis.del('security:scan:in_progress');
    }

  } catch (error) {
    console.error('Scheduled security scan failed:', error);
    
    Sentry.captureException(error, {
      tags: {
        component: 'security_cron',
        job: 'scheduled_security_scan'
      }
    });

    // Clear the in-progress flag on error
    await redis.del('security:scan:in_progress').catch(() => {});

    return NextResponse.json({
      success: false,
      error: 'Security scan failed',
      details: (error as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Send security alert for critical issues
async function sendSecurityAlert(results: any) {
  try {
    // Send to Sentry
    Sentry.captureMessage('Critical security vulnerabilities detected', {
      level: 'error',
      tags: {
        component: 'security_scan',
        severity: 'critical',
        security_score: results.combined_security_score,
      },
      extra: {
        vulnerabilities: results.total_vulnerabilities,
        critical_issues: results.critical_issues,
        audit_risk_score: results.audit.risk_score,
        scan_results: results.scan,
      }
    });

    // Store alert in Redis
    const alert = {
      timestamp: new Date().toISOString(),
      type: 'critical_security_alert',
      security_score: results.combined_security_score,
      critical_issues: results.critical_issues,
      total_vulnerabilities: results.total_vulnerabilities,
      message: `Critical security alert: ${results.critical_issues} critical issues found, security score: ${results.combined_security_score}/100`,
    };

    await redis.lpush('security:alerts:critical', JSON.stringify(alert));
    await redis.ltrim('security:alerts:critical', 0, 49); // Keep last 50 alerts

    console.log('🚨 Critical security alert sent');

  } catch (error) {
    console.error('Failed to send security alert:', error);
    Sentry.captureException(error);
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed - this is a cron endpoint' 
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed - this is a cron endpoint' 
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed - this is a cron endpoint' 
  }, { status: 405 });
}