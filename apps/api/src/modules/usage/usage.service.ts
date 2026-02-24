/**
 * Usage Service
 * =============
 * 
 * Business logic for usage metering:
 * - Current resource counts
 * - Export tracking
 * - Usage snapshots for historical data
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UsageSummary {
  totalVoters: number;
  totalSubUsers: number;
  exportsThisMonth: number;
  votersAddedThisMonth: number;
  storageGrowthPercent: number;
}

export interface UsageLimits {
  maxVoters: number;
  maxSubUsers: number;
  maxExportsPerMonth: number;
  voterUsagePercent: number;
  subUserUsagePercent: number;
  exportUsagePercent: number;
}

export interface UsageSnapshot {
  month: string;
  totalVoters: number;
  totalExports: number;
  totalUsers: number;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  // Default limits (can be customized per plan)
  private readonly DEFAULT_LIMITS = {
    maxVoters: 50000,
    maxSubUsers: 20,
    maxExportsPerMonth: 100,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current usage summary for a candidate
   */
  async getUsageSummary(candidateId: string): Promise<UsageSummary> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Execute all counts in parallel
    const [
      totalVoters,
      totalSubUsers,
      exportsThisMonth,
      votersAddedThisMonth,
      votersLastMonth,
    ] = await Promise.all([
      // Total active voters
      this.prisma.voter.count({
        where: { candidateId, isDeleted: false },
      }),

      // Total sub-users
      this.prisma.user.count({
        where: { candidateId, role: 'SUB_USER' },
      }),

      // Exports this month
      this.prisma.auditLog.count({
        where: {
          candidateId,
          action: 'CSV_EXPORTED',
          createdAt: { gte: firstDayOfMonth },
        },
      }),

      // Voters added this month
      this.prisma.voter.count({
        where: {
          candidateId,
          isDeleted: false,
          createdAt: { gte: firstDayOfMonth },
        },
      }),

      // Voters last month (for growth calculation)
      this.prisma.voter.count({
        where: {
          candidateId,
          isDeleted: false,
          createdAt: { lt: firstDayOfMonth },
        },
      }),
    ]);

    // Calculate storage growth percent
    const storageGrowthPercent =
      votersLastMonth > 0
        ? Math.round((votersAddedThisMonth / votersLastMonth) * 100)
        : votersAddedThisMonth > 0
          ? 100
          : 0;

    return {
      totalVoters,
      totalSubUsers,
      exportsThisMonth,
      votersAddedThisMonth,
      storageGrowthPercent,
    };
  }

  /**
   * Get usage with limits and percentages
   */
  async getUsageWithLimits(candidateId: string): Promise<UsageLimits> {
    const summary = await this.getUsageSummary(candidateId);
    const limits = this.DEFAULT_LIMITS;

    return {
      maxVoters: limits.maxVoters,
      maxSubUsers: limits.maxSubUsers,
      maxExportsPerMonth: limits.maxExportsPerMonth,
      voterUsagePercent: Math.round((summary.totalVoters / limits.maxVoters) * 100),
      subUserUsagePercent: Math.round((summary.totalSubUsers / limits.maxSubUsers) * 100),
      exportUsagePercent: Math.round((summary.exportsThisMonth / limits.maxExportsPerMonth) * 100),
    };
  }

  /**
   * Get historical usage snapshots
   * Note: UsageSnapshot model will be available after running prisma migrate
   */
  async getUsageHistory(candidateId: string): Promise<UsageSnapshot[]> {
    const snapshots = await this.prisma.usageSnapshot.findMany({
      where: { candidateId },
      orderBy: { month: 'desc' },
      take: 12, // Last 12 months
    });

    return snapshots.map((s: { month: string; totalVoters: number; totalExports: number; totalUsers: number }) => ({
      month: s.month,
      totalVoters: s.totalVoters,
      totalExports: s.totalExports,
      totalUsers: s.totalUsers,
    }));
  }

  /**
   * Create usage snapshot for current month
   * Called by cron job monthly
   */
  async createMonthlySnapshot(candidateId: string): Promise<void> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const summary = await this.getUsageSummary(candidateId);

    // Upsert to handle re-runs
    await this.prisma.usageSnapshot.upsert({
      where: {
        candidateId_month: {
          candidateId,
          month,
        },
      },
      create: {
        candidateId,
        month,
        totalVoters: summary.totalVoters,
        totalExports: summary.exportsThisMonth,
        totalUsers: summary.totalSubUsers + 1, // +1 for admin
      },
      update: {
        totalVoters: summary.totalVoters,
        totalExports: summary.exportsThisMonth,
        totalUsers: summary.totalSubUsers + 1,
      },
    });
  }

  /**
   * Monthly job to create snapshots for all active candidates
   * Call this from a scheduled job service
   */
  async createAllMonthlySnapshots(): Promise<void> {
    this.logger.log('Starting monthly usage snapshot generation...');

    try {
      // Get all active candidates
      const candidates = await this.prisma.candidate.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      let successCount = 0;
      let errorCount = 0;

      for (const candidate of candidates) {
        try {
          await this.createMonthlySnapshot(candidate.id);
          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to create snapshot for candidate ${candidate.id}`,
            error instanceof Error ? error.stack : undefined,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Usage snapshots complete: ${successCount} success, ${errorCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to run monthly usage snapshots',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Check if candidate is approaching limits
   */
  async checkLimitWarnings(candidateId: string): Promise<string[]> {
    const usage = await this.getUsageWithLimits(candidateId);
    const warnings: string[] = [];

    if (usage.voterUsagePercent >= 90) {
      warnings.push(`Voter storage is at ${usage.voterUsagePercent}% capacity`);
    } else if (usage.voterUsagePercent >= 80) {
      warnings.push(`Voter storage is at ${usage.voterUsagePercent}% capacity`);
    }

    if (usage.subUserUsagePercent >= 90) {
      warnings.push(`Sub-user limit is at ${usage.subUserUsagePercent}% capacity`);
    }

    if (usage.exportUsagePercent >= 90) {
      warnings.push(`Monthly export limit is at ${usage.exportUsagePercent}% capacity`);
    }

    return warnings;
  }

  /**
   * Get detailed export history
   */
  async getExportHistory(candidateId: string, limit = 20) {
    const exports = await this.prisma.auditLog.findMany({
      where: {
        candidateId,
        action: 'CSV_EXPORTED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get user info separately to avoid complex joins
    const actorIds = [...new Set(exports.map((e) => e.actorUserId).filter(Boolean))] as string[];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true, username: true },
    });
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return exports.map((e) => {
      const actor = e.actorUserId ? actorMap.get(e.actorUserId) : null;
      return {
        id: e.id,
        action: e.action,
        exportedBy: actor?.fullName || actor?.username || 'Unknown',
        timestamp: e.createdAt,
        metadata: e.metadata,
      };
    });
  }
}
