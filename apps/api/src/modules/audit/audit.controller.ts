import { Controller, Get, ParseIntPipe, Query, UseGuards, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(AuthCookieGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  listLogs(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('candidateId') candidateId?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const boundedLimit = Math.min(Math.max(limit ?? 50, 1), 200);
    return this.auditService.listLogs(actor, boundedLimit, candidateId);
  }

  @Get('voter-additions')
  voterAdditions(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('candidateId') candidateId?: string,
  ) {
    return this.auditService.voterAdditionsSummary(actor, candidateId);
  }

  /**
   * Stream audit logs as CSV export
   * Rate limited to prevent abuse
   * Filters by candidateId (tenant) automatically
   * Optionally filters by userId
   * 
   * Query params:
   * - userId: Filter to specific user's actions (optional)
   * 
   * Example:
   * GET /audit/export
   * GET /audit/export?userId=user123
   */
  @Get('export')
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 2 requests per minute
  async exportCsv(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('candidateId') candidateId?: string,
    @Query('userId') userId?: string,
    @Res() response?: Response,
  ) {
    // Set appropriate headers for CSV download
    if (response) {
      const timestamp = new Date().toISOString().split('T')[0];
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${timestamp}.csv"`,
      );
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
    }

    // Stream the CSV data
    return this.auditService.streamAuditExportCsv(
      actor,
      userId,
      response,
      candidateId,
    );
  }
}
