import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { Transform } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

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
        select: {
          id: true,
        },
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

  private async getVisibleUserIds(actor: AuthenticatedUser): Promise<string[] | null> {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') {
      return null;
    }

    const visibleUserIds: string[] = [actor.id];
    let frontier: string[] = [actor.id];

    while (frontier.length > 0) {
      const children = await this.prisma.user.findMany({
        where: {
          candidateId: actor.candidateId,
          parentUserId: { in: frontier },
        },
        select: {
          id: true,
        },
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

  private resolveCandidateScope(actor: AuthenticatedUser, targetCandidateId?: string) {
    if (actor.role === 'SUPER_ADMIN') {
      return targetCandidateId || undefined;
    }
    return actor.candidateId;
  }

  async logEvent(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    candidateId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action as Prisma.AuditLogCreateInput['action'],
          entityType: input.entityType,
          entityId: input.entityId,
          candidateId: input.candidateId,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error instanceof Error ? error.stack : undefined);
    }
  }

  async listLogs(actor: AuthenticatedUser, limit: number, targetCandidateId?: string) {
    const scopedCandidateId = this.resolveCandidateScope(actor, targetCandidateId);
    const visibleUserIds = await this.getVisibleUserIds(actor);

    const where: Prisma.AuditLogWhereInput = {
      ...(scopedCandidateId ? { candidateId: scopedCandidateId } : {}),
    };

    if (visibleUserIds) {
      where.actorUserId = { in: visibleUserIds };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async voterAdditionsSummary(
    actor: AuthenticatedUser,
    targetCandidateId?: string,
    focusUserId?: string,
  ) {
    const scopedCandidateId = this.resolveCandidateScope(actor, targetCandidateId);
    const actorVisibleUserIds = await this.getVisibleUserIds(actor);

    let visibleUserIds = actorVisibleUserIds;
    if (focusUserId) {
      if (actor.role === 'SUPER_ADMIN') {
        visibleUserIds = await this.getDescendantUserIds(focusUserId, scopedCandidateId ?? null);
      } else if (actorVisibleUserIds && !actorVisibleUserIds.includes(focusUserId)) {
        visibleUserIds = [];
      } else {
        visibleUserIds = await this.getDescendantUserIds(
          focusUserId,
          scopedCandidateId ?? actor.candidateId,
        );
      }
    }

    const users = await this.prisma.user.findMany({
      where: {
        ...(scopedCandidateId ? { candidateId: scopedCandidateId } : {}),
        role: { in: ['ADMIN', 'SUB_ADMIN', 'SUB_USER', 'VOLUNTEER'] },
        ...(visibleUserIds ? { id: { in: visibleUserIds } } : {}),
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    });

    const targetUserIds = users.map((user) => user.id);

    const voterCounts = targetUserIds.length
      ? await this.prisma.voter.groupBy({
          by: ['addedByUserId'],
          where: {
            isDeleted: false,
            ...(scopedCandidateId ? { candidateId: scopedCandidateId } : {}),
            addedByUserId: { in: targetUserIds },
          },
          _count: {
            id: true,
          },
          _max: {
            createdAt: true,
          },
        })
      : [];

    const countMap = new Map(voterCounts.map((entry) => [entry.addedByUserId, entry._count.id]));
    const lastAddedMap = new Map(voterCounts.map((entry) => [entry.addedByUserId, entry._max.createdAt]));

    const items = users.map((user) => ({
      userId: user.id,
      username: user.username,
      role: user.role,
      votersAddedCount: countMap.get(user.id) ?? 0,
      lastAddedAt: lastAddedMap.get(user.id) ?? null,
    }));

    const totals = {
      users: items.length,
      votersAdded: items.reduce((acc, item) => acc + item.votersAddedCount, 0),
    };

    return {
      items,
      totals,
    };
  }

  /**
   * Stream audit logs as CSV
   * Memory-efficient: does not load entire dataset at once
   * Supports filtering by candidate and optional user ID
   * 
   * @param candidateId - Tenant ID (from authenticated user)
   * @param userId - Optional filter for specific user's actions
   * @param response - Express response object for streaming
   */
  async streamAuditExportCsv(
    actor: AuthenticatedUser,
    userId?: string,
    response?: Response,
    targetCandidateId?: string,
  ) {
    const scopedCandidateId = this.resolveCandidateScope(actor, targetCandidateId);
    const visibleUserIds = await this.getVisibleUserIds(actor);
    const csvStream = new Transform({
      transform(chunk, encoding, callback) {
        callback(null, chunk);
      },
    });

    // Write CSV header
    const header = 'ID,Actor ID,Actor Name,Action,Entity Type,Entity ID,Created At,Metadata\n';
    if (response) {
      response.write(header);
    } else {
      csvStream.write(header);
    }

    // Query and stream logs in batches to avoid memory overload
    const batchSize = 100;
    let skip = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          ...(scopedCandidateId ? { candidateId: scopedCandidateId } : {}),
          ...(userId
            ? { actorUserId: userId }
            : visibleUserIds
              ? { actorUserId: { in: visibleUserIds } }
              : {}),
        },
        include: {
          actor: {
            select: {
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: batchSize,
      });

      if (logs.length === 0) {
        hasMoreRecords = false;
        break;
      }

      // Convert each log to CSV row and write
      for (const log of logs) {
        const row = this.formatAuditLogAsCsvRow(log);
        if (response) {
          response.write(row + '\n');
        } else {
          csvStream.write(row + '\n');
        }
      }

      skip += batchSize;
    }

    // Signal end of stream
    if (response) {
      response.end();
    } else {
      csvStream.end();
    }

    return csvStream;
  }

  /**
   * Format audit log as CSV row
   * Properly escapes commas and quotes in fields
   */
  private formatAuditLogAsCsvRow(log: any): string {
    const fields = [
      log.id,
      log.actorUserId || '',
      (log.actor?.username || '').replace(/"/g, '""'), // Escape quotes
      log.action,
      log.entityType,
      log.entityId || '',
      log.createdAt.toISOString(),
      (JSON.stringify(log.metadata || {})).replace(/"/g, '""'), // Escape quotes
    ];

    // Wrap fields with commas or quotes in double quotes
    return fields
      .map((field) => {
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str}"`;
        }
        return str;
      })
      .join(',');
  }
}

