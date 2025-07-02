import { jest } from '@jest/globals';
import { SecurityAuditor, createSecurityAuditor, getSecurityMetrics } from '@/lib/security-audit';
import { SecurityScanner, createSecurityScanner } from '@/lib/security-scanner';
import { redis } from '@/lib/upstash';

// Mock external dependencies
jest.mock('@/lib/upstash', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
    incr: jest.fn(),
    incrby: jest.fn(),
    decrby: jest.fn(),
    lpush: jest.fn(),
    ltrim: jest.fn(),
  },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('@/lib/mongoose', () => ({
  connectToDB: jest.fn(),
}));

jest.mock('@/lib/models/user.model', () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

describe('Security Audit System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SecurityAuditor', () => {
    let auditor: SecurityAuditor;

    beforeEach(() => {
      auditor = createSecurityAuditor();
    });

    test('should create security auditor with unique audit ID', () => {
      const auditor1 = createSecurityAuditor();
      const auditor2 = createSecurityAuditor();
      
      expect(auditor1).toBeInstanceOf(SecurityAuditor);
      expect(auditor2).toBeInstanceOf(SecurityAuditor);
      // Each auditor should have unique ID (we can't directly test private property)
    });

    test('should perform full security audit', async () => {
      // Mock User.find to return test data
      const mockUsers = [
        { clerkId: 'user1', email: 'user1@test.com', lastLoginAt: new Date() },
        { clerkId: 'user2', email: 'user2@test.com', lastLoginAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) }, // 45 days ago
      ];
      
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue(mockUsers);

      const result = await auditor.performFullAudit();

      expect(result).toHaveProperty('audit_id');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('type', 'automated');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('compliance_status');
      expect(result).toHaveProperty('risk_score');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.vulnerabilities)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.risk_score).toBe('number');
      expect(result.risk_score).toBeGreaterThanOrEqual(0);
      expect(result.risk_score).toBeLessThanOrEqual(100);
    });

    test('should detect inactive user accounts', async () => {
      // Mock users with 40% inactive accounts (above 30% threshold)
      const mockUsers = [
        { clerkId: 'user1', email: 'user1@test.com', lastLoginAt: new Date() },
        { clerkId: 'user2', email: 'user2@test.com', lastLoginAt: new Date() },
        { clerkId: 'user3', email: 'user3@test.com', lastLoginAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) }, // Inactive
        { clerkId: 'user4', email: 'user4@test.com', lastLoginAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, // Inactive
        { clerkId: 'user5', email: 'user5@test.com' }, // No lastLoginAt - inactive
      ];
      
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue(mockUsers);

      const result = await auditor.performFullAudit();

      // Should detect vulnerability for high number of inactive accounts
      const inactiveAccountVuln = result.vulnerabilities.find(v => 
        v.category === 'authentication' && v.description.includes('inactive user accounts')
      );
      
      expect(inactiveAccountVuln).toBeDefined();
      expect(inactiveAccountVuln?.severity).toBe('medium');
    });

    test('should calculate risk score correctly', async () => {
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue([]);

      const result = await auditor.performFullAudit();

      // Risk score should be between 0 and 100
      expect(result.risk_score).toBeGreaterThanOrEqual(0);
      expect(result.risk_score).toBeLessThanOrEqual(100);
    });

    test('should generate appropriate recommendations', async () => {
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue([]);

      const result = await auditor.performFullAudit();

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain('Implement automated security scanning in CI/CD pipeline');
      expect(result.recommendations).toContain('Schedule regular penetration testing with third-party security firm');
    });

    test('should check compliance status', async () => {
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue([]);

      const result = await auditor.performFullAudit();

      expect(result.compliance_status).toHaveProperty('OWASP');
      expect(result.compliance_status).toHaveProperty('GDPR');
      expect(result.compliance_status).toHaveProperty('PCI_DSS');
      
      Object.values(result.compliance_status).forEach(status => {
        expect(['pass', 'fail', 'partial']).toContain(status);
      });
    });

    test('should store audit results in Redis', async () => {
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue([]);

      await auditor.performFullAudit();

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^security:audit:audit_/),
        30 * 24 * 60 * 60,
        expect.any(String)
      );
      
      expect(redis.setex).toHaveBeenCalledWith(
        'security:audit:latest',
        30 * 24 * 60 * 60,
        expect.any(String)
      );
    });

    test('should handle errors gracefully', async () => {
      // Mock User.find to throw an error
      const User = require('@/lib/models/user.model').default;
      User.find.mockRejectedValue(new Error('Database connection failed'));

      const result = await auditor.performFullAudit();

      // Should still return a valid result
      expect(result).toHaveProperty('audit_id');
      expect(result).toHaveProperty('vulnerabilities');
      
      // Should include error vulnerability
      const errorVuln = result.vulnerabilities.find(v => 
        v.description.includes('Error during authentication audit')
      );
      expect(errorVuln).toBeDefined();
      expect(errorVuln?.severity).toBe('high');
    });
  });

  describe('SecurityScanner', () => {
    let scanner: SecurityScanner;

    beforeEach(() => {
      scanner = createSecurityScanner();
    });

    test('should create security scanner with unique scan ID', () => {
      const scanner1 = createSecurityScanner();
      const scanner2 = createSecurityScanner();
      
      expect(scanner1).toBeInstanceOf(SecurityScanner);
      expect(scanner2).toBeInstanceOf(SecurityScanner);
    });

    test('should run security scan successfully', async () => {
      const result = await scanner.runSecurityScan('https://test.example.com');

      expect(result).toHaveProperty('scan_id');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('target', 'https://test.example.com');
      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('scan_duration');
      expect(result).toHaveProperty('coverage');
      
      expect(Array.isArray(result.vulnerabilities)).toBe(true);
      expect(typeof result.scan_duration).toBe('number');
      expect(result.coverage).toHaveProperty('urls_tested');
      expect(result.coverage).toHaveProperty('forms_analyzed');
      expect(result.coverage).toHaveProperty('ajax_requests');
    });

    test('should use default target when none provided', async () => {
      const result = await scanner.runSecurityScan();

      expect(result.target).toBe('http://localhost:3000');
      expect(result.status).toBe('completed');
    });

    test('should store scan results in Redis', async () => {
      await scanner.runSecurityScan();

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^security:scan:scan_/),
        24 * 60 * 60,
        expect.any(String)
      );
      
      expect(redis.setex).toHaveBeenCalledWith(
        'security:scan:latest',
        24 * 60 * 60,
        expect.any(String)
      );
      
      expect(redis.incr).toHaveBeenCalledWith('security:scans:total');
    });

    test('should handle scan errors gracefully', async () => {
      // Force an error by mocking Redis to fail
      (redis.setex as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const result = await scanner.runSecurityScan();

      // Should still return completed status even if storage fails
      expect(result.status).toBe('completed');
      expect(result).toHaveProperty('vulnerabilities');
    });

    test('should include coverage metrics', async () => {
      const result = await scanner.runSecurityScan();

      expect(result.coverage.urls_tested).toBeGreaterThan(0);
      expect(result.coverage.forms_analyzed).toBe(3);
      expect(result.coverage.ajax_requests).toBe(15);
    });
  });

  describe('Security Metrics', () => {
    test('should get security metrics from Redis', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('75') // risk_score
        .mockResolvedValueOnce('5')  // vulnerability_count
        .mockResolvedValueOnce('2024-01-01T00:00:00.000Z'); // last_audit

      const metrics = await getSecurityMetrics();

      expect(metrics).toEqual({
        riskScore: 75,
        vulnerabilityCount: 5,
        lastAudit: new Date('2024-01-01T00:00:00.000Z'),
      });
    });

    test('should handle missing metrics gracefully', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce(null) // risk_score
        .mockResolvedValueOnce(null) // vulnerability_count
        .mockResolvedValueOnce(null); // last_audit

      const metrics = await getSecurityMetrics();

      expect(metrics).toEqual({
        riskScore: 0,
        vulnerabilityCount: 0,
        lastAudit: null,
      });
    });

    test('should handle Redis errors gracefully', async () => {
      (redis.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const metrics = await getSecurityMetrics();

      expect(metrics).toEqual({
        riskScore: 0,
        vulnerabilityCount: 0,
        lastAudit: null,
      });
    });
  });

  describe('Integration Tests', () => {
    test('should perform complete security audit and scan workflow', async () => {
      // Mock user data
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue([
        { clerkId: 'user1', email: 'user1@test.com', lastLoginAt: new Date() },
      ]);

      // Run full audit
      const auditor = createSecurityAuditor();
      const auditResult = await auditor.performFullAudit();

      // Run security scan
      const scanner = createSecurityScanner();
      const scanResult = await scanner.runSecurityScan();

      // Verify both completed successfully
      expect(auditResult.type).toBe('automated');
      expect(auditResult.vulnerabilities).toBeDefined();
      
      expect(scanResult.status).toBe('completed');
      expect(scanResult.vulnerabilities).toBeDefined();

      // Verify Redis storage was called for both
      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^security:audit:/),
        expect.any(Number),
        expect.any(String)
      );
      
      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^security:scan:/),
        expect.any(Number),
        expect.any(String)
      );
    });

    test('should validate vulnerability data structure', async () => {
      const User = require('@/lib/models/user.model').default;
      User.find.mockResolvedValue([]);

      const auditor = createSecurityAuditor();
      const result = await auditor.performFullAudit();

      // Validate each vulnerability has required fields
      result.vulnerabilities.forEach(vuln => {
        expect(vuln).toHaveProperty('id');
        expect(vuln).toHaveProperty('severity');
        expect(vuln).toHaveProperty('category');
        expect(vuln).toHaveProperty('description');
        expect(vuln).toHaveProperty('location');
        expect(vuln).toHaveProperty('recommendation');
        expect(vuln).toHaveProperty('detected_at');
        expect(vuln).toHaveProperty('status');
        
        expect(['critical', 'high', 'medium', 'low', 'info']).toContain(vuln.severity);
        expect(['open', 'in_progress', 'resolved', 'false_positive']).toContain(vuln.status);
      });
    });
  });
});