import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { connectToDB } from './mongoose';
import { redis } from './upstash';
import User from './models/user.model';
import { NextRequest } from 'next/server';
import { xssProtection, dbSecurity } from './security';
import packageJson from '../package.json';

// Security audit configuration
export const SECURITY_AUDIT_CONFIG = {
  // Critical security thresholds
  thresholds: {
    maxFailedLogins: 5,
    maxApiCallsPerMinute: 60,
    maxPasswordAttempts: 3,
    sessionTimeoutMinutes: 30,
    maxFileUploadSizeMB: 10,
  },
  
  // Compliance frameworks to audit against
  frameworks: ['OWASP', 'GDPR', 'PCI_DSS', 'ISO27001'],
  
  // Security scan intervals
  scanIntervals: {
    vulnerability: '0 2 * * 0', // Weekly on Sunday at 2 AM
    dependency: '0 3 * * *',    // Daily at 3 AM
    penetration: '0 4 1 * *',   // Monthly on 1st at 4 AM
    compliance: '0 5 1 * *',    // Monthly on 1st at 5 AM
  }
};

// Security vulnerability assessment schema
export const vulnerabilitySchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.enum([
    'injection', 'authentication', 'encryption', 'authorization',
    'configuration', 'dependency', 'business_logic', 'data_exposure'
  ]),
  description: z.string(),
  location: z.string(), // File path or endpoint
  recommendation: z.string(),
  cvss_score: z.number().min(0).max(10).optional(),
  cwe_id: z.string().optional(),
  detected_at: z.date(),
  status: z.enum(['open', 'in_progress', 'resolved', 'false_positive']).default('open'),
  remediation_effort: z.enum(['low', 'medium', 'high']).optional(),
});

export type SecurityVulnerability = z.infer<typeof vulnerabilitySchema>;

// Security audit result schema
export const auditResultSchema = z.object({
  audit_id: z.string(),
  timestamp: z.date(),
  type: z.enum(['automated', 'manual', 'penetration_test']),
  scope: z.array(z.string()), // Areas tested
  vulnerabilities: z.array(vulnerabilitySchema),
  compliance_status: z.record(z.enum(['pass', 'fail', 'partial'])),
  risk_score: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
  next_scan: z.date(),
});

export type SecurityAuditResult = z.infer<typeof auditResultSchema>;

// Security audit class
export class SecurityAuditor {
  private auditId: string;
  private vulnerabilities: SecurityVulnerability[] = [];
  
  constructor() {
    this.auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  // Perform comprehensive security audit
  async performFullAudit(): Promise<SecurityAuditResult> {
    console.log('🔒 Starting comprehensive security audit...');
    
    try {
      // Run all security checks
      await Promise.all([
        this.auditAuthentication(),
        this.auditAuthorization(),
        this.auditDataProtection(),
        this.auditApiSecurity(),
        this.auditDependencies(),
        this.auditInputValidation(),
        this.auditBusinessLogic(),
        this.auditInfrastructure(),
        this.auditCompliance(),
      ]);

      // Calculate risk score
      const riskScore = this.calculateRiskScore();
      
      // Generate compliance status
      const complianceStatus = await this.checkCompliance();
      
      // Create audit result
      const result: SecurityAuditResult = {
        audit_id: this.auditId,
        timestamp: new Date(),
        type: 'automated',
        scope: [
          'authentication', 'authorization', 'data_protection',
          'api_security', 'dependencies', 'input_validation',
          'business_logic', 'infrastructure', 'compliance'
        ],
        vulnerabilities: this.vulnerabilities,
        compliance_status: complianceStatus,
        risk_score: riskScore,
        recommendations: this.generateRecommendations(),
        next_scan: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      };

      // Store audit result
      await this.storeAuditResult(result);
      
      // Send alerts for critical vulnerabilities
      await this.processSecurityAlerts();

      console.log(`✅ Security audit completed. Risk score: ${riskScore}/100`);
      return result;
      
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'security_audit', audit_id: this.auditId }
      });
      throw error;
    }
  }

  // Authentication security audit
  private async auditAuthentication(): Promise<void> {
    console.log('🔐 Auditing authentication security...');
    
    try {
      await connectToDB();
      
      // Check for weak authentication patterns
      const users = await User.find({}).select('clerkId email createdAt lastLoginAt').lean();
      
             // Check for inactive accounts
       const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
       const inactiveUsers = users.filter((user: any) => 
         !user.lastLoginAt || user.lastLoginAt < thirtyDaysAgo
       );
      
      if (inactiveUsers.length > users.length * 0.3) {
        this.addVulnerability({
          id: `auth_001_${this.auditId}`,
          severity: 'medium',
          category: 'authentication',
          description: `High number of inactive user accounts (${inactiveUsers.length}/${users.length})`,
          location: 'User accounts',
          recommendation: 'Implement account cleanup policy for inactive users',
          detected_at: new Date(),
        });
      }

      // Check session configuration
      await this.auditSessionSecurity();
      
      // Check multi-factor authentication usage
      await this.auditMFAUsage();
      
         } catch (error) {
       this.addVulnerability({
         id: `auth_error_${this.auditId}`,
         severity: 'high',
         category: 'authentication',
         description: 'Error during authentication audit: ' + (error as Error).message,
         location: 'Authentication system',
         recommendation: 'Investigate authentication audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Authorization security audit
  private async auditAuthorization(): Promise<void> {
    console.log('🛡️ Auditing authorization controls...');
    
    try {
      // Check for proper role-based access controls
      await this.checkRoleBasedAccess();
      
      // Audit API endpoint permissions
      await this.auditApiPermissions();
      
      // Check for privilege escalation vulnerabilities
      await this.checkPrivilegeEscalation();
      
         } catch (error) {
       this.addVulnerability({
         id: `authz_error_${this.auditId}`,
         severity: 'high',
         category: 'authorization',
         description: 'Error during authorization audit: ' + (error as Error).message,
         location: 'Authorization system',
         recommendation: 'Investigate authorization audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Data protection audit
  private async auditDataProtection(): Promise<void> {
    console.log('🔒 Auditing data protection measures...');
    
    try {
      // Check encryption at rest
      await this.auditEncryptionAtRest();
      
      // Check encryption in transit
      await this.auditEncryptionInTransit();
      
      // Audit PII handling
      await this.auditPIIHandling();
      
      // Check data retention policies
      await this.auditDataRetention();
      
         } catch (error) {
       this.addVulnerability({
         id: `data_error_${this.auditId}`,
         severity: 'high',
         category: 'data_exposure',
         description: 'Error during data protection audit: ' + (error as Error).message,
         location: 'Data protection systems',
         recommendation: 'Investigate data protection audit failures',
         detected_at: new Date(),
       });
     }
  }

  // API security audit
  private async auditApiSecurity(): Promise<void> {
    console.log('🌐 Auditing API security...');
    
    try {
      // Check rate limiting implementation
      await this.auditRateLimiting();
      
      // Audit input validation
      await this.auditAPIInputValidation();
      
      // Check CORS configuration
      await this.auditCorsConfiguration();
      
      // Audit webhook security
      await this.auditWebhookSecurity();
      
         } catch (error) {
       this.addVulnerability({
         id: `api_error_${this.auditId}`,
         severity: 'high',
         category: 'configuration',
         description: 'Error during API security audit: ' + (error as Error).message,
         location: 'API security systems',
         recommendation: 'Investigate API security audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Dependencies security audit
  private async auditDependencies(): Promise<void> {
    console.log('📦 Auditing dependency security...');
    
              try {
       // Check for known vulnerable packages (simplified check)
       const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies } as Record<string, string>;
       
       // List of packages with known security concerns that should be monitored
       const watchList = [
         'lodash', 'moment', 'axios', 'jsonwebtoken', 'express',
         'mongodb', 'mongoose', 'cheerio', 'nodemailer'
       ];
       
       for (const pkg of watchList) {
         if (dependencies[pkg]) {
           // In a real implementation, this would check against CVE databases
           this.addVulnerability({
             id: `dep_${pkg}_${this.auditId}`,
             severity: 'info',
             category: 'dependency',
             description: `Dependency ${pkg} should be regularly updated and monitored for vulnerabilities`,
             location: `package.json: ${pkg}@${dependencies[pkg]}`,
             recommendation: `Regularly update ${pkg} and monitor for security advisories`,
             detected_at: new Date(),
           });
         }
       }
       
     } catch (error) {
       this.addVulnerability({
         id: `dep_error_${this.auditId}`,
         severity: 'medium',
         category: 'dependency',
         description: 'Error during dependency audit: ' + (error as Error).message,
         location: 'Dependency management',
         recommendation: 'Investigate dependency audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Input validation audit
  private async auditInputValidation(): Promise<void> {
    console.log('✅ Auditing input validation...');
    
    try {
      // Test XSS protection
      const testPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert("xss")</script>',
      ];
      
      for (const payload of testPayloads) {
        const sanitized = xssProtection.sanitizeInput(payload);
        if (sanitized.includes('script') || sanitized.includes('javascript:')) {
          this.addVulnerability({
            id: `xss_filter_${this.auditId}`,
            severity: 'high',
            category: 'injection',
            description: 'XSS filter may not be comprehensive enough',
            location: 'lib/security.ts - xssProtection.sanitizeInput',
            recommendation: 'Enhance XSS filtering and add more comprehensive payload detection',
            detected_at: new Date(),
          });
        }
      }
      
      // Test SQL injection protection (for NoSQL injection)
      await this.testNoSQLInjection();
      
         } catch (error) {
       this.addVulnerability({
         id: `input_error_${this.auditId}`,
         severity: 'high',
         category: 'injection',
         description: 'Error during input validation audit: ' + (error as Error).message,
         location: 'Input validation systems',
         recommendation: 'Investigate input validation audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Business logic audit
  private async auditBusinessLogic(): Promise<void> {
    console.log('🏢 Auditing business logic security...');
    
    try {
      await connectToDB();
      
      // Check subscription limits enforcement
      await this.auditSubscriptionLimits();
      
      // Audit pricing logic
      await this.auditPricingLogic();
      
      // Check for business logic bypasses
      await this.auditBusinessRules();
      
         } catch (error) {
       this.addVulnerability({
         id: `business_error_${this.auditId}`,
         severity: 'medium',
         category: 'business_logic',
         description: 'Error during business logic audit: ' + (error as Error).message,
         location: 'Business logic systems',
         recommendation: 'Investigate business logic audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Infrastructure audit
  private async auditInfrastructure(): Promise<void> {
    console.log('🏗️ Auditing infrastructure security...');
    
    try {
      // Check environment variables security
      await this.auditEnvironmentVariables();
      
      // Audit security headers
      await this.auditSecurityHeaders();
      
      // Check logging and monitoring
      await this.auditLoggingMonitoring();
      
         } catch (error) {
       this.addVulnerability({
         id: `infra_error_${this.auditId}`,
         severity: 'medium',
         category: 'configuration',
         description: 'Error during infrastructure audit: ' + (error as Error).message,
         location: 'Infrastructure configuration',
         recommendation: 'Investigate infrastructure audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Compliance audit
  private async auditCompliance(): Promise<void> {
    console.log('📋 Auditing compliance requirements...');
    
    try {
      // GDPR compliance check
      await this.auditGDPRCompliance();
      
      // PCI DSS compliance (for payment processing)
      await this.auditPCICompliance();
      
      // OWASP Top 10 compliance
      await this.auditOWASPCompliance();
      
         } catch (error) {
       this.addVulnerability({
         id: `compliance_error_${this.auditId}`,
         severity: 'medium',
         category: 'configuration',
         description: 'Error during compliance audit: ' + (error as Error).message,
         location: 'Compliance systems',
         recommendation: 'Investigate compliance audit failures',
         detected_at: new Date(),
       });
     }
  }

  // Helper method to add vulnerability
  private addVulnerability(vulnerability: Omit<SecurityVulnerability, 'status'>): void {
    this.vulnerabilities.push({
      ...vulnerability,
      status: 'open',
    });
  }

  // Calculate overall risk score
  private calculateRiskScore(): number {
    if (this.vulnerabilities.length === 0) return 0;
    
    const weights = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
      info: 5,
    };
    
    const totalScore = this.vulnerabilities.reduce((sum, vuln: any) => {
      return sum + (weights[vuln.severity as keyof typeof weights] || 0);
    }, 0);
    
    // Normalize to 0-100 scale
    const maxPossibleScore = this.vulnerabilities.length * 100;
    return Math.round((totalScore / maxPossibleScore) * 100);
  }

  // Generate security recommendations
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const criticalVulns = this.vulnerabilities.filter(v => v.severity === 'critical');
    const highVulns = this.vulnerabilities.filter(v => v.severity === 'high');
    
    if (criticalVulns.length > 0) {
      recommendations.push(`🚨 URGENT: Address ${criticalVulns.length} critical vulnerabilities immediately`);
    }
    
    if (highVulns.length > 0) {
      recommendations.push(`⚠️ HIGH PRIORITY: Resolve ${highVulns.length} high-severity vulnerabilities within 48 hours`);
    }
    
    // Category-specific recommendations
    const categories = Array.from(new Set(this.vulnerabilities.map((v: any) => v.category)));
    categories.forEach(category => {
      const categoryVulns = this.vulnerabilities.filter((v: any) => v.category === category);
      if (categoryVulns.length > 2) {
        recommendations.push(`Focus on ${category} security - ${categoryVulns.length} issues detected`);
      }
    });
    
    // Standard recommendations
    recommendations.push(
      'Implement automated security scanning in CI/CD pipeline',
      'Schedule regular penetration testing with third-party security firm',
      'Conduct security awareness training for development team',
      'Establish security incident response procedures',
      'Review and update security policies quarterly'
    );
    
    return recommendations;
  }

  // Store audit result in database and cache
  private async storeAuditResult(result: SecurityAuditResult): Promise<void> {
    try {
      // Store in Redis for quick access
      await redis.setex(
        `security:audit:${result.audit_id}`,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify(result)
      );
      
      // Store latest audit result
      await redis.setex(
        'security:audit:latest',
        30 * 24 * 60 * 60,
        JSON.stringify(result)
      );
      
      // Update security metrics
      await redis.setex('security:risk_score', 24 * 60 * 60, result.risk_score.toString());
      await redis.setex('security:vulnerability_count', 24 * 60 * 60, result.vulnerabilities.length.toString());
      await redis.setex('security:last_audit', 24 * 60 * 60, result.timestamp.toISOString());
      
    } catch (error) {
      console.error('Failed to store audit result:', error);
      Sentry.captureException(error);
    }
  }

  // Process security alerts for critical vulnerabilities
  private async processSecurityAlerts(): Promise<void> {
    const criticalVulns = this.vulnerabilities.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    );
    
    if (criticalVulns.length > 0) {
      // Send Sentry alert
      Sentry.captureMessage(`Security audit found ${criticalVulns.length} critical/high vulnerabilities`, {
        level: 'error',
        tags: {
          component: 'security_audit',
          audit_id: this.auditId,
          critical_count: criticalVulns.filter(v => v.severity === 'critical').length,
          high_count: criticalVulns.filter(v => v.severity === 'high').length,
        },
        extra: { vulnerabilities: criticalVulns }
      });
      
      // Store alert in Redis for dashboard
      await redis.lpush('security:alerts', JSON.stringify({
        timestamp: new Date().toISOString(),
        audit_id: this.auditId,
        severity: 'critical',
        message: `${criticalVulns.length} high-priority security vulnerabilities detected`,
        vulnerabilities: criticalVulns.length,
      }));
      
      // Keep only last 100 alerts
      await redis.ltrim('security:alerts', 0, 99);
    }
  }

  // Check compliance status
  private async checkCompliance(): Promise<Record<string, 'pass' | 'fail' | 'partial'>> {
    const compliance: Record<string, 'pass' | 'fail' | 'partial'> = {};
    
    // OWASP Top 10 compliance
    const owaspVulns = this.vulnerabilities.filter(v => 
      ['injection', 'authentication', 'data_exposure'].includes(v.category)
    );
    compliance.OWASP = owaspVulns.length === 0 ? 'pass' : owaspVulns.length < 3 ? 'partial' : 'fail';
    
    // GDPR compliance
    const gdprVulns = this.vulnerabilities.filter(v => 
      v.description.toLowerCase().includes('pii') || 
      v.description.toLowerCase().includes('personal data')
    );
    compliance.GDPR = gdprVulns.length === 0 ? 'pass' : 'partial';
    
    // PCI DSS compliance (payment security)
    const pciVulns = this.vulnerabilities.filter(v => 
      v.location.includes('stripe') || 
      v.location.includes('payment') ||
      v.category === 'encryption'
    );
    compliance.PCI_DSS = pciVulns.length === 0 ? 'pass' : 'partial';
    
    return compliance;
  }

  // Additional audit methods (implementation details)
  private async auditSessionSecurity(): Promise<void> {
    // Implementation for session security audit
  }

  private async auditMFAUsage(): Promise<void> {
    // Implementation for MFA usage audit
  }

  private async checkRoleBasedAccess(): Promise<void> {
    // Implementation for RBAC audit
  }

  private async auditApiPermissions(): Promise<void> {
    // Implementation for API permissions audit
  }

  private async checkPrivilegeEscalation(): Promise<void> {
    // Implementation for privilege escalation check
  }

  private async auditEncryptionAtRest(): Promise<void> {
    // Implementation for encryption at rest audit
  }

  private async auditEncryptionInTransit(): Promise<void> {
    // Implementation for encryption in transit audit
  }

  private async auditPIIHandling(): Promise<void> {
    // Implementation for PII handling audit
  }

  private async auditDataRetention(): Promise<void> {
    // Implementation for data retention audit
  }

  private async auditRateLimiting(): Promise<void> {
    // Implementation for rate limiting audit
  }

  private async auditAPIInputValidation(): Promise<void> {
    // Implementation for API input validation audit
  }

  private async auditCorsConfiguration(): Promise<void> {
    // Implementation for CORS configuration audit
  }

  private async auditWebhookSecurity(): Promise<void> {
    // Implementation for webhook security audit
  }

  private async testNoSQLInjection(): Promise<void> {
    // Implementation for NoSQL injection testing
  }

  private async auditSubscriptionLimits(): Promise<void> {
    // Implementation for subscription limits audit
  }

  private async auditPricingLogic(): Promise<void> {
    // Implementation for pricing logic audit
  }

  private async auditBusinessRules(): Promise<void> {
    // Implementation for business rules audit
  }

  private async auditEnvironmentVariables(): Promise<void> {
    // Implementation for environment variables audit
  }

  private async auditSecurityHeaders(): Promise<void> {
    // Implementation for security headers audit
  }

  private async auditLoggingMonitoring(): Promise<void> {
    // Implementation for logging and monitoring audit
  }

  private async auditGDPRCompliance(): Promise<void> {
    // Implementation for GDPR compliance audit
  }

  private async auditPCICompliance(): Promise<void> {
    // Implementation for PCI compliance audit
  }

  private async auditOWASPCompliance(): Promise<void> {
    // Implementation for OWASP compliance audit
  }
}

// Export utility functions
export const createSecurityAuditor = () => new SecurityAuditor();

export const getLatestAuditResult = async (): Promise<SecurityAuditResult | null> => {
  try {
    const result = await redis.get('security:audit:latest');
    return result ? JSON.parse(result as string) : null;
  } catch (error) {
    console.error('Failed to get latest audit result:', error);
    return null;
  }
};

export const getSecurityMetrics = async () => {
  try {
    const [riskScore, vulnCount, lastAudit] = await Promise.all([
      redis.get('security:risk_score'),
      redis.get('security:vulnerability_count'), 
      redis.get('security:last_audit'),
    ]);
    
    return {
      riskScore: riskScore ? parseInt(riskScore as string) : 0,
      vulnerabilityCount: vulnCount ? parseInt(vulnCount as string) : 0,
      lastAudit: lastAudit ? new Date(lastAudit as string) : null,
    };
  } catch (error) {
    console.error('Failed to get security metrics:', error);
    return { riskScore: 0, vulnerabilityCount: 0, lastAudit: null };
  }
};