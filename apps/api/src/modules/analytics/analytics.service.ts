/**
 * Analytics Service
 * =================
 * 
 * Business logic for campaign analytics:
 * - Daily voter additions with date range support
 * - Sub-user productivity metrics
 * - Voting progress and zone breakdown
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';

export interface DailyVoterData {
  date: string;
  count: number;
}

export interface SubUserProductivity {
  userId: string;
  username: string;
  fullName: string | null;
  totalAdded: number;
  votedCount: number;
  conversionRate: number;
}

export interface ZoneBreakdown {
  zoneId: string;
  zoneName: string;
  total: number;
  voted: number;
  pending: number;
  percentage: number;
}

export interface VotingProgress {
  totalVoters: number;
  totalVoted: number;
  overallPercentage: number;
  zones: ZoneBreakdown[];
}

export interface AnalyticsSummary {
  dailyAdditions: DailyVoterData[];
  todayAdditions: number;
  weekAdditions: number;
  monthAdditions: number;
  monthOverMonthGrowth: number;
  totalVoters: number;
  totalVoted: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getDescendantUserIds(rootUserId: string, candidateId: string | null): Promise<string[]> {
    const visibleUserIds: string[] = [rootUserId];
    let frontier: string[] = [rootUserId];

    while (frontier.length > 0) {
      const children = await this.prisma.user.findMany({
        where: {
          ...(candidateId ? { candidateId } : {}),
          parentUserId: { in: frontier },
        },
        select: { id: true },
      });

      const childIds = children.map((entry) => entry.id);
      if (childIds.length === 0) {
        break;
      }

      visibleUserIds.push(...childIds);
      frontier = childIds;
    }

    return visibleUserIds;
  }

  private async resolveScope(
    actor: AuthenticatedUser,
    targetCandidateId?: string,
    focusUserId?: string,
  ) {
    if (actor.role === 'SUPER_ADMIN') {
      const scopedCandidateId = targetCandidateId || undefined;
      const visibleUserIds = focusUserId
        ? await this.getDescendantUserIds(focusUserId, scopedCandidateId ?? null)
        : null;

      return {
        scopedCandidateId,
        visibleUserIds,
      };
    }

    if (actor.role === 'ADMIN') {
      const baseCandidateId = actor.candidateId;
      const focusedVisibleIds = focusUserId
        ? await this.getDescendantUserIds(focusUserId, baseCandidateId)
        : null;

      return {
        scopedCandidateId: baseCandidateId,
        visibleUserIds: focusedVisibleIds,
      };
    }

    const actorVisibleUserIds = await this.getDescendantUserIds(actor.id, actor.candidateId);
    let visibleUserIds: string[] = actorVisibleUserIds;

    if (focusUserId) {
      if (!actorVisibleUserIds.includes(focusUserId)) {
        visibleUserIds = [];
      } else {
        visibleUserIds = await this.getDescendantUserIds(focusUserId, actor.candidateId);
      }
    }

    return {
      scopedCandidateId: actor.candidateId,
      visibleUserIds,
    };
  }

  /**
   * Get daily voter additions for a date range
   */
  async getDailyVoterAdditions(
    actor: AuthenticatedUser,
    targetCandidateId: string | undefined,
    focusUserId: string | undefined,
    range: DateRange = '30d',
  ): Promise<DailyVoterData[]> {
    const { scopedCandidateId: candidateId, visibleUserIds } = await this.resolveScope(
      actor,
      targetCandidateId,
      focusUserId,
    );
    const startDate = this.getStartDate(range);

    if (visibleUserIds && visibleUserIds.length === 0) {
      return this.fillDateGaps([], startDate, new Date());
    }

    const candidateClause = candidateId
      ? Prisma.sql`AND "candidateId" = ${candidateId}`
      : Prisma.empty;
    const visibleUsersClause = visibleUserIds
      ? Prisma.sql`AND "addedByUserId" IN (${Prisma.join(visibleUserIds)})`
      : Prisma.empty;

    const results = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>(Prisma.sql`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as count
      FROM "Voter"
      WHERE
        "isDeleted" = false
        AND "createdAt" >= ${startDate}
        ${candidateClause}
        ${visibleUsersClause}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `);

    // Convert to response format and fill in missing dates
    return this.fillDateGaps(
      results.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        count: Number(r.count),
      })),
      startDate,
      new Date(),
    );
  }

  /**
   * Get sub-user productivity metrics
   */
  async getSubUserProductivity(
    actor: AuthenticatedUser,
    targetCandidateId?: string,
    focusUserId?: string,
  ): Promise<SubUserProductivity[]> {
    const { scopedCandidateId: candidateId, visibleUserIds } = await this.resolveScope(
      actor,
      targetCandidateId,
      focusUserId,
    );

    // Get all sub-users for this candidate
    const candidateClause = candidateId
      ? Prisma.sql`AND u."candidateId" = ${candidateId}`
      : Prisma.empty;
    const visibleUsersClause = visibleUserIds
      ? Prisma.sql`AND u.id IN (${Prisma.join(visibleUserIds)})`
      : Prisma.empty;

    const subUsers = await this.prisma.$queryRaw<
      { id: string; fullName: string | null; username: string }[]
    >(Prisma.sql`
      SELECT u.id, u."fullName", u.username
      FROM "User" u
      WHERE u.role::text IN ('SUB_ADMIN', 'SUB_USER', 'VOLUNTEER')
        ${candidateClause}
        ${visibleUsersClause}
      ORDER BY u.username ASC
    `);

    // Get voter counts grouped by addedByUserId
    const voterCounts = await this.prisma.voter.groupBy({
      by: ['addedByUserId'],
      where: {
        isDeleted: false,
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
      _count: {
        id: true,
      },
    });

    // Get voted counts grouped by addedByUserId
    const votedCounts = await this.prisma.voter.groupBy({
      by: ['addedByUserId'],
      where: {
        isDeleted: false,
        voted: true,
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
      _count: {
        id: true,
      },
    });

    // Build lookup maps
    const voterCountMap = new Map(
      voterCounts.map((v) => [v.addedByUserId, v._count.id]),
    );
    const votedCountMap = new Map(
      votedCounts.map((v) => [v.addedByUserId, v._count.id]),
    );

    // Combine data
    const productivity: SubUserProductivity[] = subUsers.map((user) => {
      const totalAdded = voterCountMap.get(user.id) || 0;
      const votedCount = votedCountMap.get(user.id) || 0;
      return {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        totalAdded,
        votedCount,
        conversionRate: totalAdded > 0 ? Math.round((votedCount / totalAdded) * 100) : 0,
      };
    });

    // Sort by total added (descending)
    return productivity.sort((a, b) => b.totalAdded - a.totalAdded);
  }

  /**
   * Get voting progress with zone breakdown
   */
  async getVotingProgress(
    actor: AuthenticatedUser,
    targetCandidateId?: string,
    focusUserId?: string,
  ): Promise<VotingProgress> {
    const { scopedCandidateId: candidateId, visibleUserIds } = await this.resolveScope(
      actor,
      targetCandidateId,
      focusUserId,
    );

    // Get zones for this candidate
    const zones = await this.prisma.zone.findMany({
      where: candidateId ? { candidateId } : undefined,
      select: {
        id: true,
        name: true,
        type: true,
        colorHex: true,
      },
    });

    // Get voter counts per zone
    const zoneCounts = await this.prisma.voter.groupBy({
      by: ['zoneId'],
      where: {
        isDeleted: false,
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
      _count: {
        id: true,
      },
    });

    // Get voted counts per zone
    const zoneVotedCounts = await this.prisma.voter.groupBy({
      by: ['zoneId'],
      where: {
        isDeleted: false,
        voted: true,
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
      _count: {
        id: true,
      },
    });

    // Build lookup maps
    const totalCountMap = new Map(
      zoneCounts.map((z) => [z.zoneId, z._count.id]),
    );
    const votedCountMap = new Map(
      zoneVotedCounts.map((z) => [z.zoneId, z._count.id]),
    );

    // Build zone breakdown
    const zoneBreakdown: ZoneBreakdown[] = zones.map((zone) => {
      const total = totalCountMap.get(zone.id) || 0;
      const voted = votedCountMap.get(zone.id) || 0;
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        total,
        voted,
        pending: total - voted,
        percentage: total > 0 ? Math.round((voted / total) * 100) : 0,
      };
    });

    // Calculate totals
    const totalVoters = zoneBreakdown.reduce((sum, z) => sum + z.total, 0);
    const totalVoted = zoneBreakdown.reduce((sum, z) => sum + z.voted, 0);

    return {
      totalVoters,
      totalVoted,
      overallPercentage: totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0,
      zones: zoneBreakdown,
    };
  }

  /**
   * Get analytics summary for dashboard
   */
  async getAnalyticsSummary(
    actor: AuthenticatedUser,
    targetCandidateId?: string,
    focusUserId?: string,
  ): Promise<AnalyticsSummary> {
    const { scopedCandidateId: candidateId, visibleUserIds } = await this.resolveScope(
      actor,
      targetCandidateId,
      focusUserId,
    );
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get daily additions for last 30 days
    const dailyAdditions = await this.getDailyVoterAdditions(actor, candidateId, focusUserId, '30d');

    // Count voters added today
    const todayAdditions = await this.prisma.voter.count({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfToday },
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
    });

    // Count voters added this week
    const weekAdditions = await this.prisma.voter.count({
      where: {
        isDeleted: false,
        createdAt: { gte: oneWeekAgo },
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
    });

    // Count voters added this month
    const monthAdditions = await this.prisma.voter.count({
      where: {
        isDeleted: false,
        createdAt: { gte: firstDayThisMonth },
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
    });

    // Count voters added last month
    const votersLastMonth = await this.prisma.voter.count({
      where: {
        isDeleted: false,
        createdAt: {
          gte: firstDayLastMonth,
          lt: firstDayThisMonth,
        },
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
    });

    // Calculate growth
    const monthOverMonthGrowth =
      votersLastMonth > 0
        ? Math.round(((monthAdditions - votersLastMonth) / votersLastMonth) * 100)
        : monthAdditions > 0
          ? 100
          : 0;

    // Get totals
    const [totalVoters, totalVoted] = await this.prisma.$transaction([
      this.prisma.voter.count({
        where: {
          isDeleted: false,
          ...(candidateId ? { candidateId } : {}),
          ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
        },
      }),
      this.prisma.voter.count({
        where: {
          isDeleted: false,
          voted: true,
          ...(candidateId ? { candidateId } : {}),
          ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
        },
      }),
    ]);

    return {
      dailyAdditions,
      todayAdditions,
      weekAdditions,
      monthAdditions,
      monthOverMonthGrowth,
      totalVoters,
      totalVoted,
    };
  }

  /**
   * Get top performers (sub-users with most voters added this week)
   */
  async getTopPerformers(
    actor: AuthenticatedUser,
    targetCandidateId: string | undefined,
    focusUserId: string | undefined,
    limit = 5,
  ) {
    const { scopedCandidateId: candidateId, visibleUserIds } = await this.resolveScope(
      actor,
      targetCandidateId,
      focusUserId,
    );
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const topPerformers = await this.prisma.voter.groupBy({
      by: ['addedByUserId'],
      where: {
        isDeleted: false,
        createdAt: { gte: oneWeekAgo },
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    // Get voted counts this week per user
    const votedThisWeek = await this.prisma.voter.groupBy({
      by: ['addedByUserId'],
      where: {
        isDeleted: false,
        voted: true,
        createdAt: { gte: oneWeekAgo },
        ...(candidateId ? { candidateId } : {}),
        ...(visibleUserIds ? { addedByUserId: { in: visibleUserIds } } : {}),
      },
      _count: {
        id: true,
      },
    });

    const votedMap = new Map(votedThisWeek.map((v) => [v.addedByUserId, v._count.id]));

    // Get user details
    const userIds = topPerformers.map((p) => p.addedByUserId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, username: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return topPerformers.map((p) => {
      const user = userMap.get(p.addedByUserId);
      return {
        userId: p.addedByUserId,
        username: user?.username || 'unknown',
        fullName: user?.fullName || null,
        weeklyAdded: p._count.id,
        weeklyVoted: votedMap.get(p.addedByUserId) || 0,
      };
    });
  }

  /**
   * Helper: Get start date based on range
   */
  private getStartDate(range: DateRange): Date {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      case 'all':
        return new Date('2020-01-01');
      default:
        return new Date(now.setDate(now.getDate() - 30));
    }
  }

  /**
   * Helper: Fill in missing dates with zero counts
   */
  private fillDateGaps(
    data: DailyVoterData[],
    startDate: Date,
    endDate: Date,
  ): DailyVoterData[] {
    const dataMap = new Map(data.map((d) => [d.date, d.count]));
    const result: DailyVoterData[] = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: dataMap.get(dateStr) || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }
}
