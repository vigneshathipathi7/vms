/**
 * Usage Controller
 * ================
 * 
 * REST endpoints for usage metering.
 * Admin-only and tenant-isolated.
 */

import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsageService } from './usage.service';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/auth.types';

@Controller('usage')
@UseGuards(AuthCookieGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  /**
   * GET /usage/summary
   * 
   * Returns current usage summary.
   */
  @Get('summary')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getUsageSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.usageService.getUsageSummary(user.candidateId);
  }

  /**
   * GET /usage/limits
   * 
   * Returns usage with plan limits.
   */
  @Get('limits')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getUsageLimits(@CurrentUser() user: AuthenticatedUser) {
    const [limits, warnings] = await Promise.all([
      this.usageService.getUsageWithLimits(user.candidateId),
      this.usageService.checkLimitWarnings(user.candidateId),
    ]);

    return { ...limits, warnings };
  }

  /**
   * GET /usage/history
   * 
   * Returns historical usage snapshots.
   */
  @Get('history')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getUsageHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.usageService.getUsageHistory(user.candidateId);
  }

  /**
   * GET /usage/exports
   * 
   * Returns recent export history.
   */
  @Get('exports')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getExportHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.usageService.getExportHistory(user.candidateId);
  }
}
