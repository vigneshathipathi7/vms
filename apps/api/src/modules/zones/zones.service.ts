import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { ListVotersQueryDto } from '../voters/dto/list-voters-query.dto';
import { VotersService } from '../voters/voters.service';

const DEFAULT_ZONES = [
  { type: 'RED' as const, name: 'Red Zone', colorHex: '#ef4444' },
  { type: 'GREEN' as const, name: 'Green Zone', colorHex: '#22c55e' },
  { type: 'ORANGE' as const, name: 'Orange Zone', colorHex: '#f97316' },
];

@Injectable()
export class ZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly votersService: VotersService,
  ) {}

  async listZones(actor: AuthenticatedUser) {
    if (!actor.candidateId) {
      return { items: [] };
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

    const result = await Promise.all(
      zones.map(async (zone) => {
        const [total, pending] = await this.prisma.$transaction([
          this.prisma.voter.count({ where: { zoneId: zone.id, candidateId: actor.candidateId, isDeleted: false } }),
          this.prisma.voter.count({ where: { zoneId: zone.id, candidateId: actor.candidateId, isDeleted: false, voted: false } }),
        ]);

        return {
          ...zone,
          total,
          pending,
          voted: total - pending,
        };
      }),
    );

    return { items: result };
  }

  async listZoneVoters(zoneId: string, query: ListVotersQueryDto, actor: AuthenticatedUser) {
    if (!zoneId) {
      throw new BadRequestException('zoneId is required');
    }

    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, candidateId: actor.candidateId },
      select: {
        id: true,
        type: true,
        name: true,
        colorHex: true,
      },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    const voters = await this.votersService.listVoters({
      ...query,
      zoneId,
    }, actor);

    return {
      zone,
      ...voters,
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
