import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';

const DEFAULT_ZONES = [
  { type: 'RED' as const, name: 'Red Zone', colorHex: '#ef4444' },
  { type: 'GREEN' as const, name: 'Green Zone', colorHex: '#22c55e' },
  { type: 'ORANGE' as const, name: 'Orange Zone', colorHex: '#f97316' },
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(actor: AuthenticatedUser) {
    if (actor.role === 'SUPER_ADMIN') {
      const [total, pending, voters] = await this.prisma.$transaction([
        this.prisma.voter.count({ where: { isDeleted: false } }),
        this.prisma.voter.count({ where: { isDeleted: false, voted: false } }),
        this.prisma.voter.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          include: {
            addedBy: {
              select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
              },
            },
            candidate: {
              select: {
                id: true,
                fullName: true,
                electionType: true,
                contestingFor: true,
                state: true,
                district: true,
                constituency: true,
                assemblyConstituency: true,
                taluk: true,
              },
            },
            zone: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            ward: {
              select: {
                id: true,
                wardNumber: true,
              },
            },
            taluk: {
              select: {
                id: true,
                name: true,
              },
            },
            village: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      return {
        zones: [],
        totals: {
          total,
          pending,
          voted: total - pending,
        },
        superAdminVoters: voters,
      };
    }

    if (!actor.candidateId) {
      return {
        zones: [],
        totals: { total: 0, pending: 0, voted: 0 },
      };
    }

    await this.ensureDefaultZones(actor.candidateId);

    const zones = await this.prisma.zone.findMany({
      where: { candidateId: actor.candidateId },
      orderBy: { type: 'asc' },
      select: {
        id: true,
        type: true,
        name: true,
        colorHex: true,
      },
    });

    const zoneStats = await Promise.all(
      zones.map(async (zone) => {
        const [total, pending] = await this.prisma.$transaction([
          this.prisma.voter.count({
            where: { zoneId: zone.id, candidateId: actor.candidateId, isDeleted: false },
          }),
          this.prisma.voter.count({
            where: {
              zoneId: zone.id,
              candidateId: actor.candidateId,
              isDeleted: false,
              voted: false,
            },
          }),
        ]);

        return {
          zone,
          total,
          pending,
          voted: total - pending,
        };
      }),
    );

    const totals = zoneStats.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.pending += row.pending;
        acc.voted += row.voted;
        return acc;
      },
      { total: 0, pending: 0, voted: 0 },
    );

    return {
      zones: zoneStats,
      totals,
    };
  }

  private async ensureDefaultZones(candidateId: string) {
    const existingCount = await this.prisma.zone.count({ where: { candidateId } });
    if (existingCount > 0) {
      return;
    }

    await this.prisma.zone.createMany({
      data: DEFAULT_ZONES.map((zone) => ({
        ...zone,
        candidateId,
      })),
      skipDuplicates: true,
    });
  }
}
