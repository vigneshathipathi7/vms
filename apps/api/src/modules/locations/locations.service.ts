import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/auth.types';

/**
 * LocationsService - READ-ONLY
 * 
 * This service provides read access to master geographic data.
 * Master data is IMMUTABLE and cannot be modified via API.
 * All updates must be done via scripts/import-tn-constituencies.ts
 */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all districts (SHARED globally - READ ONLY).
   */
  async getDistricts() {
    return this.prisma.district.findMany({
      select: { id: true, name: true, stateCode: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get all taluks (SHARED globally - READ ONLY).
   * Optionally filter by specific taluk IDs or isLgdBlock.
   * 
   * @param options.assignedTalukIds - Filter to specific taluks
   * @param options.isLgdBlock - true = LGD Blocks, false = Revenue Taluks, undefined = all
   * @param options.districtName - Filter to specific district by name
   */
  async getTaluks(options?: { assignedTalukIds?: string[]; isLgdBlock?: boolean; districtName?: string }) {
    const where: { id?: { in: string[] }; isLgdBlock?: boolean; district?: { name: string } } = {};
    
    if (options?.assignedTalukIds?.length) {
      where.id = { in: options.assignedTalukIds };
    }
    
    if (options?.isLgdBlock !== undefined) {
      where.isLgdBlock = options.isLgdBlock;
    }

    if (options?.districtName) {
      where.district = { name: options.districtName };
    }

    return this.prisma.taluk.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        districtId: true,
        isLgdBlock: true,
        district: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get LGD Blocks for LOCAL_BODY elections (SHARED globally - READ ONLY).
   * LGD Blocks are administrative blocks from Local Government Directory.
   */
  async getLgdBlocks(districtId?: string) {
    return this.prisma.taluk.findMany({
      where: {
        isLgdBlock: true,
        ...(districtId && { districtId }),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        districtId: true,
        lgdCode: true,
        district: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get Revenue Taluks (SHARED globally - READ ONLY).
   * Revenue Taluks are traditional administrative divisions.
   */
  async getRevenueTaluks(districtId?: string) {
    return this.prisma.taluk.findMany({
      where: {
        isLgdBlock: false,
        ...(districtId && { districtId }),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        districtId: true,
        district: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get all taluks grouped by district (SHARED globally - READ ONLY).
   * @param isLgdBlock - true = LGD Blocks only, false = Revenue Taluks only, undefined = all
   */
  async getTaluksByDistrict(isLgdBlock?: boolean) {
    const taluks = await this.prisma.taluk.findMany({
      where: isLgdBlock !== undefined ? { isLgdBlock } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        districtId: true,
        isLgdBlock: true,
        district: { select: { id: true, name: true } },
      },
    });

    // Group by district
    const grouped: Record<string, { district: { id: string; name: string }; taluks: typeof taluks }> = {};
    for (const taluk of taluks) {
      const districtName = taluk.district.name;
      if (!grouped[districtName]) {
        grouped[districtName] = {
          district: taluk.district,
          taluks: [],
        };
      }
      grouped[districtName].taluks.push(taluk);
    }

    return Object.values(grouped).sort((a, b) => a.district.name.localeCompare(b.district.name));
  }

  /**
   * Get villages in a taluk (SHARED globally - READ ONLY).
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
   * Get wards in a village (SHARED globally - READ ONLY).
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
   * Get all Assembly Constituencies (SHARED globally - READ ONLY).
   * Optionally filter by district.
   */
  async getAssemblyConstituencies(districtId?: string) {
    return this.prisma.assemblyConstituency.findMany({
      where: districtId ? { districtId } : undefined,
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        districtId: true,
        parliamentaryConstituencyId: true,
        district: { select: { id: true, name: true } },
        parliamentaryConstituency: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get all Parliamentary Constituencies (SHARED globally - READ ONLY).
   */
  async getParliamentaryConstituencies() {
    return this.prisma.parliamentaryConstituency.findMany({
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        stateCode: true,
        _count: { select: { assemblyConstituencies: true } },
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

  /**
   * Get location statistics with taluk type breakdown (READ ONLY).
   */
  async getLocationStats() {
    const [
      districts,
      totalTaluks,
      revenueTaluks,
      lgdBlocks,
      villages,
      wards,
      assemblies,
      parliamentary,
    ] = await Promise.all([
      this.prisma.district.count(),
      this.prisma.taluk.count(),
      this.prisma.taluk.count({ where: { isLgdBlock: false } }),
      this.prisma.taluk.count({ where: { isLgdBlock: true } }),
      this.prisma.village.count(),
      this.prisma.ward.count(),
      this.prisma.assemblyConstituency.count(),
      this.prisma.parliamentaryConstituency.count(),
    ]);

    return {
      districts,
      taluks: totalTaluks,
      revenueTaluks,
      lgdBlocks,
      villages,
      wards,
      assemblyConstituencies: assemblies,
      parliamentaryConstituencies: parliamentary,
    };
  }
}
