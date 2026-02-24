import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all unique districts (SHARED globally).
   */
  async getDistricts() {
    const taluks = await this.prisma.taluk.findMany({
      select: { district: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });

    return taluks.map((t, idx) => ({
      id: `district-${idx}`,
      name: t.district,
    }));
  }

  /**
   * Get all taluks (SHARED globally - no candidateId filter).
   * Optionally filter by specific taluk IDs.
   */
  async getTaluks(assignedTalukIds?: string[]) {
    const where: { id?: { in: string[] } } = {};
    
    if (assignedTalukIds?.length) {
      where.id = { in: assignedTalukIds };
    }

    return this.prisma.taluk.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        district: true,
      },
    });
  }

  /**
   * Get all taluks grouped by district (SHARED globally).
   */
  async getTaluksByDistrict() {
    const taluks = await this.prisma.taluk.findMany({
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        district: true,
      },
    });

    // Group by district
    const grouped: Record<string, typeof taluks> = {};
    for (const taluk of taluks) {
      if (!grouped[taluk.district]) {
        grouped[taluk.district] = [];
      }
      grouped[taluk.district].push(taluk);
    }

    return Object.entries(grouped).map(([district, taluks]) => ({
      district,
      taluks,
    }));
  }

  /**
   * Get villages in a taluk (SHARED globally - no candidateId filter).
   */
  async getVillages(talukId: string) {
    return this.prisma.village.findMany({
      where: { talukId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        talukId: true,
      },
    });
  }

  /**
   * Get wards in a village (SHARED globally - no candidateId filter).
   */
  async getWards(villageId: string) {
    return this.prisma.ward.findMany({
      where: { villageId },
      orderBy: { wardNumber: 'asc' },
      select: {
        id: true,
        wardNumber: true,
        villageId: true,
      },
    });
  }

  /**
   * Get all zones for a candidate (TENANT-SCOPED - requires candidateId).
   */
  async getZones(actor: AuthenticatedUser) {
    return this.prisma.zone.findMany({
      where: { candidateId: actor.candidateId },
      orderBy: { type: 'asc' },
      select: {
        id: true,
        type: true,
        name: true,
        colorHex: true,
      },
    });
  }
}
