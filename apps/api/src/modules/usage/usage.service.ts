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
import { AuthenticatedUser } from '../auth/types/auth.types';

export interface UsageSummary {
  totalVoters: number;
  totalVoted: number;
  totalPending: number;
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

export interface UsageUserScopeItem {
  userId: string;
  username: string;
  fullName: string | null;
  email: string | null;
  candidateId: string;
  candidateName: string;
  totalSubUsers: number;
  totalVoters: number;
  totalVoted: number;
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

  private resolveCandidateScope(user: AuthenticatedUser, targetCandidateId?: string) {
    if (user.role !== 'SUPER_ADMIN') {
      return user.candidateId;
    }
    return targetCandidateId || undefined;
  }

  private getScope(user: AuthenticatedUser, targetCandidateId?: string) {
    const scopedCandidateId = this.resolveCandidateScope(user, targetCandidateId);

    if (!scopedCandidateId) {
      return {
        voterWhereBase: { isDeleted: false } as const,
        userWhereBase: { role: 'SUB_USER' as const },
        auditWhereBase: { action: 'CSV_EXPORTED' as const },
        scopedCandidateId: undefined,
      };
    }

    return {
      voterWhereBase: { candidateId: scopedCandidateId, isDeleted: false } as const,
      userWhereBase: { candidateId: scopedCandidateId, role: 'SUB_USER' as const },
      auditWhereBase: { candidateId: scopedCandidateId, action: 'CSV_EXPORTED' as const },
      scopedCandidateId,
    };
  }

  /**
   * Get current usage summary for a candidate
   */
  async getUsageSummary(user: AuthenticatedUser, targetCandidateId?: string): Promise<UsageSummary> {
    const scope = this.getScope(user, targetCandidateId);
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Execute all counts in parallel
    const [
      totalVoters,
      totalVoted,
      totalPending,
      totalSubUsers,
      exportsThisMonth,
      votersAddedThisMonth,
      votersLastMonth,
    ] = await Promise.all([
      // Total active voters
      this.prisma.voter.count({
        where: scope.voterWhereBase,
      }),

      // Total voted
      this.prisma.voter.count({
        where: {
          ...scope.voterWhereBase,
          voted: true,
        },
      }),

      // Total pending (not voted)
      this.prisma.voter.count({
        where: {
          ...scope.voterWhereBase,
          voted: false,
        },
      }),

      // Total sub-users
      this.prisma.user.count({
        where: scope.userWhereBase,
      }),

      // Exports this month
      this.prisma.auditLog.count({
        where: {
          ...scope.auditWhereBase,
          createdAt: { gte: firstDayOfMonth },
        },
      }),

      // Voters added this month
      this.prisma.voter.count({
        where: {
          ...scope.voterWhereBase,
          createdAt: { gte: firstDayOfMonth },
        },
      }),

      // Voters before this month (for growth calculation)
      this.prisma.voter.count({
        where: {
          ...scope.voterWhereBase,
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
      totalVoted,
      totalPending,
      totalSubUsers,
      exportsThisMonth,
      votersAddedThisMonth,
      storageGrowthPercent,
    };
  }

  /**
   * Get usage with limits and percentages
   */
  async getUsageWithLimits(user: AuthenticatedUser, targetCandidateId?: string): Promise<UsageLimits> {
    const summary = await this.getUsageSummary(user, targetCandidateId);
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
  async getUsageHistory(user: AuthenticatedUser, targetCandidateId?: string): Promise<UsageSnapshot[]> {
    const scopedCandidateId = this.resolveCandidateScope(user, targetCandidateId);

    if (!scopedCandidateId) {
      return [];
    }

    const snapshots = await this.prisma.usageSnapshot.findMany({
      where: { candidateId: scopedCandidateId },
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

    const summary = await this.getUsageSummary({
      id: 'system',
      username: 'system',
      role: 'ADMIN',
      mfaEnabled: false,
      candidateId,
      electionLevel: null,
    });

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
  async checkLimitWarnings(user: AuthenticatedUser, targetCandidateId?: string): Promise<string[]> {
    const usage = await this.getUsageWithLimits(user, targetCandidateId);
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
  async getExportHistory(user: AuthenticatedUser, limit = 20, targetCandidateId?: string) {
    const scopedCandidateId = this.resolveCandidateScope(user, targetCandidateId);
    const where = scopedCandidateId
      ? { candidateId: scopedCandidateId, action: 'CSV_EXPORTED' as const }
      : { action: 'CSV_EXPORTED' as const };

    const exports = await this.prisma.auditLog.findMany({
      where,
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

  async getUsageUsers(user: AuthenticatedUser): Promise<UsageUserScopeItem[]> {
    if (user.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findFirst({
        where: { id: user.id },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          candidateId: true,
          candidate: { select: { fullName: true } },
        },
      });

      if (!admin || !admin.candidateId) {
        return [];
      }

      const [totalSubUsers, totalVoters, totalVoted] = await Promise.all([
        this.prisma.user.count({ where: { candidateId: admin.candidateId, role: 'SUB_USER' } }),
        this.prisma.voter.count({ where: { candidateId: admin.candidateId, isDeleted: false } }),
        this.prisma.voter.count({ where: { candidateId: admin.candidateId, isDeleted: false, voted: true } }),
      ]);

      return [
        {
          userId: admin.id,
          username: admin.username,
          fullName: admin.fullName,
          email: admin.email,
          candidateId: admin.candidateId,
          candidateName: admin.candidate?.fullName ?? admin.username,
          totalSubUsers,
          totalVoters,
          totalVoted,
        },
      ];
    }

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', candidateId: { not: null } },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        candidateId: true,
        candidate: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { username: 'asc' },
    });

    const candidateIds = admins
      .map((admin) => admin.candidateId)
      .filter((value): value is string => Boolean(value));

    if (candidateIds.length === 0) {
      return [];
    }

    const [subUserCounts, voterCounts, votedCounts] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['candidateId'],
        where: { role: 'SUB_USER', candidateId: { in: candidateIds } },
        _count: { id: true },
      }),
      this.prisma.voter.groupBy({
        by: ['candidateId'],
        where: { candidateId: { in: candidateIds }, isDeleted: false },
        _count: { id: true },
      }),
      this.prisma.voter.groupBy({
        by: ['candidateId'],
        where: { candidateId: { in: candidateIds }, isDeleted: false, voted: true },
        _count: { id: true },
      }),
    ]);

    const subUserMap = new Map(subUserCounts.map((row) => [row.candidateId, row._count.id]));
    const voterMap = new Map(voterCounts.map((row) => [row.candidateId, row._count.id]));
    const votedMap = new Map(votedCounts.map((row) => [row.candidateId, row._count.id]));

    return admins
      .filter((admin): admin is typeof admin & { candidateId: string } => Boolean(admin.candidateId))
      .map((admin) => ({
        userId: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        candidateId: admin.candidateId,
        candidateName: admin.candidate?.fullName ?? admin.username,
        totalSubUsers: subUserMap.get(admin.candidateId) ?? 0,
        totalVoters: voterMap.get(admin.candidateId) ?? 0,
        totalVoted: votedMap.get(admin.candidateId) ?? 0,
      }));
  }
}
