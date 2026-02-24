import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { Transform } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  async listLogs(candidateId: string, limit: number) {
    return this.prisma.auditLog.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async voterAdditionsSummary(candidateId: string) {
    const items = await this.prisma.$queryRaw<
      {
        userId: string;
        username: string;
        role: string;
        votersAddedCount: number;
        lastAddedAt: Date | null;
      }[]
    >(Prisma.sql`
      SELECT
        u.id AS "userId",
        u.username,
        u.role::text AS role,
        COUNT(v.id)::int AS "votersAddedCount",
        MAX(v."createdAt") AS "lastAddedAt"
      FROM "User" u
      LEFT JOIN "Voter" v ON v."addedByUserId" = u.id AND v."isDeleted" = false
      WHERE u.role IN ('ADMIN'::"UserRole", 'SUB_USER'::"UserRole")
        AND u."candidateId" = ${candidateId}
      GROUP BY u.id
      ORDER BY u.role ASC, u.username ASC
    `);

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
    candidateId: string,
    userId?: string,
    response?: Response,
  ) {
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
          candidateId,
          ...(userId && { actorUserId: userId }),
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

