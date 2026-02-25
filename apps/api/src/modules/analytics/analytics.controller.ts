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
    @Query('candidateId') candidateId?: string,
    @Query('range') range?: '7d' | '30d' | '90d' | 'all',
  ) {
    const scopedCandidateId = user.role === 'SUPER_ADMIN' ? candidateId : user.candidateId;
    return this.analyticsService.getDailyVoterAdditions(
      scopedCandidateId,
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
  async getSubUserProductivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('candidateId') candidateId?: string,
  ) {
    const scopedCandidateId = user.role === 'SUPER_ADMIN' ? candidateId : user.candidateId;
    return this.analyticsService.getSubUserProductivity(scopedCandidateId);
  }

  /**
   * GET /analytics/voting-progress
   * 
   * Returns overall voting progress with zone breakdown.
   */
  @Get('voting-progress')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getVotingProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query('candidateId') candidateId?: string,
  ) {
    const scopedCandidateId = user.role === 'SUPER_ADMIN' ? candidateId : user.candidateId;
    return this.analyticsService.getVotingProgress(scopedCandidateId);
  }

  /**
   * GET /analytics/summary
   * 
   * Returns combined analytics summary for dashboard.
   */
  @Get('summary')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getAnalyticsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('candidateId') candidateId?: string,
  ) {
    const scopedCandidateId = user.role === 'SUPER_ADMIN' ? candidateId : user.candidateId;
    // Log analytics access
    await this.auditService.logEvent({
      actorUserId: user.id,
      action: 'AUDIT_EXPORTED', // Reusing existing action for analytics access
      entityType: 'Analytics',
      candidateId: scopedCandidateId,
      metadata: { type: 'summary', candidateId: scopedCandidateId ?? 'ALL' },
    });

    return this.analyticsService.getAnalyticsSummary(scopedCandidateId);
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
    @Query('candidateId') candidateId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 20) : 5;
    const scopedCandidateId = user.role === 'SUPER_ADMIN' ? candidateId : user.candidateId;
    return this.analyticsService.getTopPerformers(scopedCandidateId, parsedLimit);
  }
}
