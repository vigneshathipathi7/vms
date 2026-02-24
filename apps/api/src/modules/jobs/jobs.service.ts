/**
 * Background Jobs Module
 * ======================
 * 
 * Scheduled tasks for production system maintenance:
 * - Clean expired refresh tokens
 * - Archive old audit logs
 * - Database cleanup and optimization
 * 
 * Uses NestJS @nestjs/schedule for cron-based execution
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Clean up expired refresh tokens
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanExpiredRefreshTokens() {
    try {
      const now = new Date();
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired refresh tokens`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean expired refresh tokens',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Clean up expired trusted device tokens
   * Runs daily at 2:15 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanExpiredTrustedDevices() {
    try {
      const now = new Date();
      const result = await this.prisma.trustedDevice.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired trusted devices`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean expired trusted devices',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Clean up old used recovery codes
   * Runs daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanUsedRecoveryCodes() {
    try {
      // Delete recovery codes that were used more than 30 days ago
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await this.prisma.recoveryCode.deleteMany({
        where: {
          usedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} old used recovery codes`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean recovery codes',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Clean up old MFA challenges
   * Runs daily at 3:30 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanExpiredMfaChallenges() {
    try {
      const now = new Date();
      const result = await this.prisma.mfaChallenge.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired MFA challenges`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean MFA challenges',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Soft-delete permanent purge
   * Delete voters marked as deleted more than 90 days ago
   * Runs weekly on Sundays at 4 AM
   */
  @Cron('0 4 * * 0') // Every Sunday at 4 AM
  async purgeOldDeletedVoters() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const result = await this.prisma.voter.deleteMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Permanently deleted ${result.count} voters (soft-delete purge)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to purge old deleted voters',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Database maintenance and vacuuming
   * Runs weekly on Sundays at 5 AM
   */
  @Cron('0 5 * * 0') // Every Sunday at 5 AM
  async optimizeDatabase() {
    try {
      this.logger.log('Starting database optimization...');
      
      // Run VACUUM ANALYZE on PostgreSQL to optimize query planner
      await this.prisma.$executeRawUnsafe('VACUUM ANALYZE');
      
      this.logger.log('Database optimization completed');
    } catch (error) {
      // VACUUM might not be available on all databases (e.g., MySQL)
      // Silently fail for compatibility
      this.logger.debug('Database optimization skipped (may not be supported)');
    }
  }

  /**
   * Archive old audit logs
   * Keeps last 6 months of audit logs in main table
   * Runs monthly on the 1st at 6 AM
   */
  @Cron('0 6 1 * *') // 1st of every month at 6 AM
  async archiveOldAuditLogs() {
    try {
      const sixMonthsAgo = new Date(
        Date.now() - 6 * 30 * 24 * 60 * 60 * 1000,
      );

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: sixMonthsAgo,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Archived/purged ${result.count} old audit logs (>6 months)`,
        );
        
        // Log this maintenance action
        await this.auditService.logEvent({
          action: 'AUDIT_CLEANUP',
          entityType: 'System',
          metadata: {
            logsDeleted: result.count,
            olderThan: sixMonthsAgo.toISOString(),
          },
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to archive old audit logs',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
