import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(actor: AuthenticatedUser) {
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
}
