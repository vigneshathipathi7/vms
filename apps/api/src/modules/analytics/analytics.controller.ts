/**
 * Analytics Controller
 * ====================
 * 
 * REST endpoints for campaign analytics.
 * All endpoints are admin-only and tenant-isolated.
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { AuditService } from '../audit/audit.service';

@Controller('analytics')
@UseGuards(AuthCookieGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /analytics/daily-voters
   * 
   * Returns daily voter additions for the specified date range.
   */
  @Get('daily-voters')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getDailyVoters(
    @CurrentUser() user: AuthenticatedUser,
    @Query('range') range?: '7d' | '30d' | '90d' | 'all',
  ) {
    return this.analyticsService.getDailyVoterAdditions(
      user.candidateId,
      range || '30d',
    );
  }

  /**
   * GET /analytics/subuser-productivity
   * 
   * Returns productivity metrics for all sub-users.
   */
  @Get('subuser-productivity')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getSubUserProductivity(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getSubUserProductivity(user.candidateId);
  }

  /**
   * GET /analytics/voting-progress
   * 
   * Returns overall voting progress with zone breakdown.
   */
  @Get('voting-progress')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getVotingProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getVotingProgress(user.candidateId);
  }

  /**
   * GET /analytics/summary
   * 
   * Returns combined analytics summary for dashboard.
   */
  @Get('summary')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getAnalyticsSummary(@CurrentUser() user: AuthenticatedUser) {
    // Log analytics access
    await this.auditService.logEvent({
      actorUserId: user.id,
      action: 'AUDIT_EXPORTED', // Reusing existing action for analytics access
      entityType: 'Analytics',
      candidateId: user.candidateId,
      metadata: { type: 'summary' },
    });

    return this.analyticsService.getAnalyticsSummary(user.candidateId);
  }

  /**
   * GET /analytics/top-performers
   * 
   * Returns top sub-users by voters added this week.
   */
  @Get('top-performers')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getTopPerformers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 20) : 5;
    return this.analyticsService.getTopPerformers(user.candidateId, parsedLimit);
  }
}
