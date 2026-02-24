import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, ElectionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkMarkVotedDto } from './dto/bulk-mark-voted.dto';
import { BulkMoveZoneDto } from './dto/bulk-move-zone.dto';
import { CreateVoterDto } from './dto/create-voter.dto';
import { ListVotersQueryDto } from './dto/list-voters-query.dto';
import { UpdateVoterDto } from './dto/update-voter.dto';

const AUDIT_VOTER_CREATED = 'VOTER_CREATED';
const AUDIT_VOTER_UPDATED = 'VOTER_UPDATED';
const AUDIT_VOTER_DELETED = 'VOTER_DELETED';
const AUDIT_VOTER_MARKED_VOTED = 'VOTER_MARKED_VOTED';
const AUDIT_ZONE_TRANSFERRED = 'ZONE_TRANSFERRED';
const AUDIT_CSV_EXPORTED = 'CSV_EXPORTED';

@Injectable()
export class VotersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get allowed ward IDs for a user.
   * Returns null to allow all users to see all voters under the same tenant.
   * Tenant isolation is enforced by candidateId filter instead.
   */
  private async getAllowedWardIds(_actor: AuthenticatedUser): Promise<string[] | null> {
    // All users (admin and sub-users) can see all voters under the same tenant
    return null;
  }

  /**
   * Check if actor has access to a specific ward.
   * All users under the same tenant have access to all wards.
   */
  private async hasWardAccess(_actor: AuthenticatedUser, _wardId: string): Promise<boolean> {
    // All users can access all wards within their tenant
    return true;
  }

  /**
   * Validate hierarchy fields based on election type.
   * - LOCAL_BODY: talukId, villageId, wardId all required
   * - ASSEMBLY: constituency required, talukId/villageId optional
   * - PARLIAMENT: state, constituency, assemblyConstituency required, talukId/villageId optional
   */
  private async validateHierarchy(
    payload: CreateVoterDto,
    electionType: ElectionType,
  ): Promise<void> {
    switch (electionType) {
      case 'LOCAL_BODY':
        if (!payload.talukId) {
          throw new BadRequestException('talukId is required for LOCAL_BODY elections');
        }
        if (!payload.villageId) {
          throw new BadRequestException('villageId is required for LOCAL_BODY elections');
        }
        break;

      case 'ASSEMBLY':
        if (!payload.constituency) {
          throw new BadRequestException('constituency is required for ASSEMBLY elections');
        }
        break;

      case 'PARLIAMENT':
        if (!payload.state) {
          throw new BadRequestException('state is required for PARLIAMENT elections');
        }
        if (!payload.constituency) {
          throw new BadRequestException('constituency (parliamentary) is required for PARLIAMENT elections');
        }
        if (!payload.assemblyConstituency) {
          throw new BadRequestException('assemblyConstituency is required for PARLIAMENT elections');
        }
        break;

      default:
        throw new BadRequestException(`Unknown election type: ${electionType}`);
    }
  }

  async listVoters(query: ListVotersQueryDto, actor: AuthenticatedUser) {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const allowedWardIds = await this.getAllowedWardIds(actor);
    const where = this.buildWhere(query, actor.candidateId, allowedWardIds);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.voter.count({ where }),
      this.prisma.voter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          taluk: { select: { id: true, name: true } },
          village: { select: { id: true, name: true } },
          ward: { select: { id: true, wardNumber: true } },
          zone: {
            select: {
              id: true,
              type: true,
              name: true,
              colorHex: true,
            },
          },
          addedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getVotedVoters(query: ListVotersQueryDto, actor: AuthenticatedUser) {
    return this.listVoters({ ...query, voted: 'true' }, actor);
  }

  async getFilterOptions(query: Pick<ListVotersQueryDto, 'zoneId'>, actor: AuthenticatedUser) {
    const where: Prisma.VoterWhereInput = {
      candidateId: actor.candidateId,
      isDeleted: false,
    };

    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }

    // Apply SubUserWard restrictions for SUB_USER role
    const allowedWardIds = await this.getAllowedWardIds(actor);
    if (allowedWardIds !== null) {
      where.wardId = { in: allowedWardIds };
    }

    const [wardRows, addressRows, addedByRows] = await this.prisma.$transaction([
      this.prisma.voter.findMany({
        where,
        distinct: ['wardId'],
        select: { ward: { select: { id: true, wardNumber: true } } },
      }),
      this.prisma.voter.findMany({
        where,
        distinct: ['address'],
        orderBy: { address: 'asc' },
        select: { address: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'SUB_USER', candidateId: actor.candidateId },
        orderBy: { username: 'asc' },
        select: { id: true, username: true },
      }),
    ]);

    const addresses = addressRows.map((row) => row.address);
    const wards = wardRows.map((row) => row.ward).sort((a, b) => a.wardNumber.localeCompare(b.wardNumber));

    return {
      wards,
      addresses,
      // Backward compatibility for older UI state keys.
      streetNames: addresses,
      addedByUsers: addedByRows,
    };
  }

  async exportVotersCsv(query: ListVotersQueryDto, actor: AuthenticatedUser) {
    const allowedWardIds = await this.getAllowedWardIds(actor);
    const where = this.buildWhere(query, actor.candidateId, allowedWardIds);
    const voters = await this.prisma.voter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ward: {
          select: { wardNumber: true },
        },
        zone: {
          select: { name: true, type: true },
        },
        addedBy: {
          select: { username: true },
        },
      },
    });

    // Log CSV export for audit trail
    await this.auditService.logEvent({
      actorUserId: actor.id,
      candidateId: actor.candidateId,
      action: AUDIT_CSV_EXPORTED,
      entityType: 'Voter',
      metadata: {
        count: voters.length,
        filters: query,
      },
    });

    const header = [
      'name',
      'contact_number',
      'voter_id',
      'ward_number',
      'address',
      'zone_name',
      'zone_type',
      'voted',
      'added_by',
      'created_at',
    ];

    const rows = voters.map((voter) => [
      voter.name,
      voter.contactNumber,
      voter.voterId,
      voter.ward.wardNumber,
      voter.address,
      voter.zone.name,
      voter.zone.type,
      String(voter.voted),
      voter.addedBy.username,
      voter.createdAt.toISOString(),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => this.escapeCsv(value)).join(','))
      .join('\n');

    return csv;
  }

  async createVoter(payload: CreateVoterDto, actor: AuthenticatedUser) {
    // Get candidate's election type to validate hierarchy
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: actor.candidateId },
      select: { electionType: true },
    });

    if (!candidate) {
      throw new BadRequestException('Candidate not found');
    }

    // Validate hierarchy based on election type
    await this.validateHierarchy(payload, candidate.electionType);

    // Validate zone exists and belongs to same candidate (TENANT-SCOPED)
    const zone = await this.prisma.zone.findFirst({
      where: { id: payload.zoneId, candidateId: actor.candidateId },
      select: { id: true },
    });

    if (!zone) {
      throw new BadRequestException('Invalid zoneId');
    }

    // Validate ward exists (SHARED location data - no candidateId)
    const ward = await this.prisma.ward.findFirst({
      where: { id: payload.wardId },
    });

    if (!ward) throw new BadRequestException('Invalid wardId');

    // Validate taluk and village for LOCAL_BODY elections (SHARED location data)
    if (candidate.electionType === 'LOCAL_BODY') {
      const [taluk, village] = await Promise.all([
        this.prisma.taluk.findFirst({ where: { id: payload.talukId } }),
        this.prisma.village.findFirst({ where: { id: payload.villageId } }),
      ]);

      if (!taluk) throw new BadRequestException('Invalid talukId (required for LOCAL_BODY elections)');
      if (!village) throw new BadRequestException('Invalid villageId (required for LOCAL_BODY elections)');
      if (village.talukId !== taluk.id) throw new BadRequestException('Village does not belong to selected taluk');
      if (ward.villageId !== village.id) throw new BadRequestException('Ward does not belong to selected village');
    }

    // For SUB_USER, verify they have access to this ward
    if (!await this.hasWardAccess(actor, payload.wardId)) {
      throw new ForbiddenException('You do not have permission to add voters to this ward');
    }

    try {
      const voter = await this.prisma.voter.create({
        data: {
          name: payload.name,
          contactNumber: payload.contactNumber,
          voterId: payload.voterId,
          // Dynamic hierarchy fields
          state: payload.state,
          constituency: payload.constituency,
          assemblyConstituency: payload.assemblyConstituency,
          talukId: payload.talukId || null,
          villageId: payload.villageId || null,
          wardId: payload.wardId,
          address: payload.address,
          zoneId: payload.zoneId,
          addedByUserId: actor.id,
          candidateId: actor.candidateId,
        },
        include: {
          taluk: { select: { id: true, name: true } },
          village: { select: { id: true, name: true } },
          ward: { select: { id: true, wardNumber: true } },
          zone: {
            select: {
              id: true,
              type: true,
              name: true,
              colorHex: true,
            },
          },
          addedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      await this.auditService.logEvent({
        actorUserId: actor.id,
        candidateId: actor.candidateId,
        action: AUDIT_VOTER_CREATED,
        entityType: 'Voter',
        entityId: voter.id,
        metadata: {
          voterId: voter.voterId,
          zoneId: voter.zoneId,
        },
      });

      return { item: voter };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new ConflictException('Voter ID already exists');
      }
      throw error;
    }
  }

  async updateVoter(voterId: string, payload: UpdateVoterDto, actor: AuthenticatedUser) {
    // Find voter ensuring it belongs to the same candidate
    const existing = await this.prisma.voter.findFirst({
      where: { id: voterId, candidateId: actor.candidateId, isDeleted: false },
      select: { id: true, wardId: true },
    });

    if (!existing) {
      throw new NotFoundException('Voter not found');
    }

    // For SUB_USER, verify they have access to this voter's ward
    if (!await this.hasWardAccess(actor, existing.wardId)) {
      throw new ForbiddenException('You do not have permission to update this voter');
    }

    if (payload.zoneId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: payload.zoneId, candidateId: actor.candidateId },
        select: { id: true },
      });
      if (!zone) {
        throw new BadRequestException('Invalid zoneId');
      }
    }

    // If changing ward, verify SUB_USER has access to the new ward
    if (payload.wardId && payload.wardId !== existing.wardId) {
      if (!await this.hasWardAccess(actor, payload.wardId)) {
        throw new ForbiddenException('You do not have permission to move voters to this ward');
      }
    }

    try {
      const updated = await this.prisma.voter.update({
        where: { id: voterId },
        data: {
          name: payload.name,
          contactNumber: payload.contactNumber,
          voterId: payload.voterId,
          talukId: payload.talukId,
          villageId: payload.villageId,
          wardId: payload.wardId,
          address: payload.address,
          zoneId: payload.zoneId,
          voted: payload.voted,
        },
        include: {
          taluk: { select: { id: true, name: true } },
          village: { select: { id: true, name: true } },
          ward: { select: { id: true, wardNumber: true } },
          zone: {
            select: {
              id: true,
              type: true,
              name: true,
              colorHex: true,
            },
          },
          addedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      await this.auditService.logEvent({
        actorUserId: actor.id,
        candidateId: actor.candidateId,
        action: AUDIT_VOTER_UPDATED,
        entityType: 'Voter',
        entityId: updated.id,
        metadata: {
          updatedFields: Object.keys(payload),
        },
      });

      return { item: updated };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new ConflictException('Voter ID already exists');
      }
      throw error;
    }
  }

  async deleteVoter(voterId: string, actor: AuthenticatedUser) {
    // Find voter ensuring it belongs to the same candidate
    const existing = await this.prisma.voter.findFirst({
      where: { id: voterId, candidateId: actor.candidateId, isDeleted: false },
      select: { id: true, voterId: true, wardId: true },
    });

    if (!existing) {
      throw new NotFoundException('Voter not found');
    }

    // For SUB_USER, verify they have access to this voter's ward
    if (!await this.hasWardAccess(actor, existing.wardId)) {
      throw new ForbiddenException('You do not have permission to delete this voter');
    }

    // Soft delete instead of hard delete
    await this.prisma.voter.update({
      where: { id: voterId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await this.auditService.logEvent({
      actorUserId: actor.id,
      candidateId: actor.candidateId,
      action: AUDIT_VOTER_DELETED,
      entityType: 'Voter',
      entityId: voterId,
      metadata: {
        voterId: existing.voterId,
      },
    });

    return {
      deleted: true,
      id: voterId,
    };
  }

  async bulkMarkVoted(payload: BulkMarkVotedDto, actor: AuthenticatedUser) {
    const uniqueIds = [...new Set(payload.voterIds)];
    const voted = payload.voted ?? true;

    // Build where clause with tenant isolation
    const where: Prisma.VoterWhereInput = {
      id: { in: uniqueIds },
      candidateId: actor.candidateId,
      isDeleted: false,
    };

    // Apply SubUserWard restrictions for SUB_USER role
    const allowedWardIds = await this.getAllowedWardIds(actor);
    if (allowedWardIds !== null) {
      where.wardId = { in: allowedWardIds };
    }

    const result = await this.prisma.voter.updateMany({
      where,
      data: { voted },
    });

    await this.auditService.logEvent({
      actorUserId: actor.id,
      candidateId: actor.candidateId,
      action: AUDIT_VOTER_MARKED_VOTED,
      entityType: 'Voter',
      metadata: {
        count: result.count,
        voted,
      },
    });

    return {
      updatedCount: result.count,
      voted,
    };
  }

  async bulkMoveZone(payload: BulkMoveZoneDto, actor: AuthenticatedUser) {
    // Validate zone exists and belongs to same candidate
    const zone = await this.prisma.zone.findFirst({
      where: { id: payload.targetZoneId, candidateId: actor.candidateId },
      select: { id: true },
    });

    if (!zone) {
      throw new BadRequestException('Invalid targetZoneId');
    }

    const uniqueIds = [...new Set(payload.voterIds)];

    // Build where clause with tenant isolation
    const where: Prisma.VoterWhereInput = {
      id: { in: uniqueIds },
      candidateId: actor.candidateId,
      isDeleted: false,
    };

    // Apply SubUserWard restrictions for SUB_USER role
    const allowedWardIds = await this.getAllowedWardIds(actor);
    if (allowedWardIds !== null) {
      where.wardId = { in: allowedWardIds };
    }

    const result = await this.prisma.voter.updateMany({
      where,
      data: {
        zoneId: payload.targetZoneId,
      },
    });

    await this.auditService.logEvent({
      actorUserId: actor.id,
      candidateId: actor.candidateId,
      action: AUDIT_ZONE_TRANSFERRED,
      entityType: 'Voter',
      metadata: {
        count: result.count,
        targetZoneId: payload.targetZoneId,
      },
    });

    return {
      updatedCount: result.count,
      targetZoneId: payload.targetZoneId,
    };
  }

  async bulkDelete(payload: BulkDeleteDto, actor: AuthenticatedUser) {
    const uniqueIds = [...new Set(payload.voterIds)];

    // Build where clause with tenant isolation
    const where: Prisma.VoterWhereInput = {
      id: { in: uniqueIds },
      candidateId: actor.candidateId,
      isDeleted: false,
    };

    // Apply SubUserWard restrictions for SUB_USER role
    const allowedWardIds = await this.getAllowedWardIds(actor);
    if (allowedWardIds !== null) {
      where.wardId = { in: allowedWardIds };
    }

    // Soft delete instead of hard delete
    const result = await this.prisma.voter.updateMany({
      where,
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await this.auditService.logEvent({
      actorUserId: actor.id,
      candidateId: actor.candidateId,
      action: AUDIT_VOTER_DELETED,
      entityType: 'Voter',
      metadata: {
        count: result.count,
        bulk: true,
      },
    });

    return {
      deletedCount: result.count,
    };
  }

  private buildWhere(
    query: ListVotersQueryDto,
    candidateId: string,
    allowedWardIds: string[] | null,
  ): Prisma.VoterWhereInput {
    const where: Prisma.VoterWhereInput = {
      candidateId,
      isDeleted: false,
    };

    // Apply SubUserWard restrictions if applicable
    if (allowedWardIds !== null) {
      where.wardId = { in: allowedWardIds };
    }

    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }

    if (query.talukId) {
      where.talukId = query.talukId;
    }

    if (query.villageId) {
      where.villageId = query.villageId;
    }

    if (query.wardId) {
      // If SubUserWard restriction is in place, ensure the requested ward is allowed
      if (allowedWardIds !== null && !allowedWardIds.includes(query.wardId)) {
        // Return an impossible condition to get zero results
        where.id = 'impossible-id-no-match';
      } else {
        where.wardId = query.wardId;
      }
    }

    if (query.address) {
      where.address = {
        contains: query.address,
        mode: 'insensitive',
      };
    }

    if (query.addedByUserId) {
      where.addedByUserId = query.addedByUserId;
    }

    if (query.voted === 'true') {
      where.voted = true;
    } else if (query.voted === 'false') {
      where.voted = false;
    }

    if (query.search) {
      where.OR = [
        {
          name: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          voterId: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  private normalizePage(page?: number) {
    if (!page || page < 1) {
      return 1;
    }
    return page;
  }

  private normalizePageSize(pageSize?: number) {
    if (!pageSize || pageSize < 1) {
      return 25;
    }
    return Math.min(pageSize, 200);
  }

  private escapeCsv(value: string) {
    const normalized = value.replaceAll('"', '""');
    return `"${normalized}"`;
  }
}
