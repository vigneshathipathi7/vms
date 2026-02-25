import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CreateSubUserDto } from './dto/create-sub-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSubUserDto } from './dto/update-sub-user.dto';

const AUDIT_USER_CREATED = 'USER_CREATED';
const ADMIN_PROFILE_FIELDS = new Set<keyof UpdateProfileDto>([
  'fullName',
  'phone',
  'email',
  'officeAddress',
  'electionLevel',
  'constituencyName',
  'positionContesting',
  'partyName',
  'profilePhoto',
  'bio',
  'talukId',
  'villageId',
]);
const SUB_USER_PROFILE_FIELDS = new Set<keyof UpdateProfileDto>([
  'fullName',
  'phone',
  'email',
  'managedVillageId',
  'managedWardId',
  'profilePhoto',
  'bio',
]);

type UserProfileRow = {
  id: string;
  username: string;
  role: 'ADMIN' | 'SUB_USER';
  mfaEnabled: boolean;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  officeAddress: string | null;
  electionLevel: string | null;
  constituencyName: string | null;
  positionContesting: string | null;
  partyName: string | null;
  profilePhoto: string | null;
  bio: string | null;
  managedVillageId: string | null;
  managedWardId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SubUserListRow = {
  id: string;
  username: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  managedVillageId: string | null;
  managedWardId: string | null;
  managedVillage: { id: string; name: string } | null;
  managedWard: { id: string; wardNumber: string } | null;
  mfaEnabled: boolean;
  createdAt: Date;
  votersAddedCount: number;
};

type ProfileColumn =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'officeAddress'
  | 'electionLevel'
  | 'constituencyName'
  | 'positionContesting'
  | 'partyName'
  | 'profilePhoto'
  | 'bio'
  | 'managedVillageId'
  | 'managedWardId';

@Injectable()
export class UsersService {
  private existingUserColumnsCache: Set<string> | null = null;
  private existingUserColumnsPromise: Promise<Set<string>> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) { }

  async listSubUsers(candidateId: string) {
    const users = await this.prisma.user.findMany({
      where: { 
        role: 'SUB_USER',
        candidateId, // Tenant filter
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        managedVillageId: true,
        managedWardId: true,
        managedVillage: { select: { id: true, name: true } },
        managedWard: { select: { id: true, wardNumber: true } },
        mfaEnabled: true,
        createdAt: true,
        _count: { select: { createdVoters: { where: { isDeleted: false } } } },
      },
    });

    const items: SubUserListRow[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      phone: u.phone,
      email: u.email,
      managedVillageId: u.managedVillageId,
      managedWardId: u.managedWardId,
      managedVillage: u.managedVillage,
      managedWard: u.managedWard,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
      votersAddedCount: u._count.createdVoters,
    }));

    return { items };
  }

  async createSubUser(payload: CreateSubUserDto, actor: AuthenticatedUser) {
    // Check username uniqueness within the candidate
    const existing = await this.prisma.user.findFirst({
      where: { 
        candidateId: actor.candidateId,
        username: payload.username,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    // Check email uniqueness globally
    const emailExists = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (emailExists) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await argon2.hash(payload.password);

    const created = await this.prisma.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        candidateId: actor.candidateId, // Set tenant
        passwordHash,
        role: 'SUB_USER',
      },
      select: {
        id: true,
      },
    });

    const adminProfile = await this.getProfile(actor.id);
    const inheritedConstituency = adminProfile.item.constituencyName || undefined;

    // Support both managedWardId (single) and assignedWardIds (array) - use first ward from array
    const effectiveWardId = payload.managedWardId || payload.assignedWardIds?.[0];

    try {
      await this.applyProfileColumns(created.id, {
        fullName: this.normalizeOptionalText(payload.fullName),
        phone: this.normalizeOptionalText(payload.phone),
        email: this.normalizeOptionalText(payload.email),
        managedVillageId: this.normalizeOptionalText(payload.managedVillageId),
        managedWardId: this.normalizeOptionalText(effectiveWardId),
        constituencyName: inheritedConstituency,
      });
    } catch (error) {
      if (this.isEmailConflict(error)) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }

    await this.auditService.logEvent({
      actorUserId: actor.id,
      action: AUDIT_USER_CREATED,
      entityType: 'User',
      entityId: created.id,
      candidateId: actor.candidateId,
      metadata: {
        createdRole: 'SUB_USER',
      },
    });

    const profile = await this.getProfile(created.id);
    return { item: profile.item };
  }

  async updateSubUser(subUserId: string, payload: UpdateSubUserDto, actor: AuthenticatedUser) {
    // Verify the sub-user belongs to the same tenant
    const subUser = await this.prisma.user.findFirst({
      where: {
        id: subUserId,
        role: 'SUB_USER',
        candidateId: actor.candidateId,
      },
    });

    if (!subUser) {
      throw new NotFoundException('Sub-user not found');
    }

    const updates: { passwordHash?: string; phone?: string; email?: string } = {};

    if (payload.password) {
      updates.passwordHash = await argon2.hash(payload.password);
    }

    if (payload.phone) {
      updates.phone = payload.phone;
    }

    if (payload.email) {
      // Check email uniqueness if provided
      const emailExists = await this.prisma.user.findFirst({
        where: { email: payload.email, id: { not: subUserId } },
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
      updates.email = payload.email;
    }

    if (Object.keys(updates).length === 0) {
      return { message: 'No changes provided' };
    }

    await this.prisma.user.update({
      where: { id: subUserId },
      data: updates,
    });

    return { message: 'Sub-user updated' };
  }

  async deleteSubUser(subUserId: string, actor: AuthenticatedUser) {
    // Verify the sub-user belongs to the same tenant
    const subUser = await this.prisma.user.findFirst({
      where: {
        id: subUserId,
        role: 'SUB_USER',
        candidateId: actor.candidateId,
      },
    });

    if (!subUser) {
      throw new NotFoundException('Sub-user not found');
    }

    // Delete the sub-user
    await this.prisma.user.delete({
      where: { id: subUserId },
    });

    return { message: 'Sub-user deleted' };
  }

  async getProfile(userId: string) {
    const profile = await this.findProfileById(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    
    // For ADMIN users, also fetch Candidate-level talukId/villageId
    if (profile.role === 'ADMIN') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          candidateId: true,
          candidate: {
            select: {
              fullName: true,
              phone: true,
              electionType: true,
              contestingFor: true,
              partyName: true,
              bio: true,
              district: true,
              constituency: true,
              taluk: true,
              talukId: true,
              villageId: true,
            },
          },
        },
      });

      const candidate = user?.candidate;

      return { 
        item: {
          ...profile,
          fullName: profile.fullName ?? candidate?.fullName ?? null,
          phone: profile.phone ?? candidate?.phone ?? null,
          electionLevel:
            profile.electionLevel ??
            (candidate?.electionType ? candidate.electionType.replace(/_/g, ' ') : null),
          constituencyName:
            profile.constituencyName ?? candidate?.constituency ?? candidate?.district ?? candidate?.taluk ?? null,
          positionContesting: profile.positionContesting ?? candidate?.contestingFor ?? null,
          partyName: profile.partyName ?? candidate?.partyName ?? null,
          bio: profile.bio ?? candidate?.bio ?? null,
          talukId: user?.candidate?.talukId ?? null,
          villageId: user?.candidate?.villageId ?? null,
        },
      };
    }
    
    return { item: profile };
  }

  async updateProfile(payload: UpdateProfileDto, actor: AuthenticatedUser) {
    const allowedFields = actor.role === 'ADMIN' ? ADMIN_PROFILE_FIELDS : SUB_USER_PROFILE_FIELDS;
    const updates: Partial<Record<ProfileColumn, string | null>> = {};
    const candidateUpdates: { talukId?: string | null; villageId?: string | null } = {};
    const keys = Object.keys(payload) as (keyof UpdateProfileDto)[];

    for (const key of keys) {
      const value = payload[key];
      if (value === undefined) {
        continue;
      }

      if (!allowedFields.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated for your role`);
      }

      // Handle Candidate-level fields separately
      if (key === 'talukId' || key === 'villageId') {
        candidateUpdates[key] = this.normalizeOptionalText(value) ?? null;
      } else {
        updates[key] = this.normalizeOptionalText(value);
      }
    }

    if (Object.keys(updates).length === 0 && Object.keys(candidateUpdates).length === 0) {
      return this.getProfile(actor.id);
    }

    try {
      // Update User fields
      if (Object.keys(updates).length > 0) {
        await this.applyProfileColumns(actor.id, updates);
      }
      
      // Update Candidate fields for panchayat elections (ADMIN only)
      if (Object.keys(candidateUpdates).length > 0 && actor.role === 'ADMIN') {
        await this.prisma.candidate.update({
          where: { id: actor.candidateId },
          data: candidateUpdates,
        });
      }
    } catch (error) {
      if (this.isEmailConflict(error)) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }

    return this.getProfile(actor.id);
  }

  private async findProfileById(userId: string) {
    const rows = await this.prisma.$queryRaw<UserProfileRow[]>(Prisma.sql`
      SELECT
        u.id,
        u.username,
        u.role::text AS role,
        u."mfaEnabled",
        ${await this.optionalUserTextColumnSql('u', 'fullName')},
        ${await this.optionalUserTextColumnSql('u', 'phone')},
        ${await this.optionalUserTextColumnSql('u', 'email')},
        ${await this.optionalUserTextColumnSql('u', 'officeAddress')},
        ${await this.optionalUserTextColumnSql('u', 'electionLevel')},
        ${await this.optionalUserTextColumnSql('u', 'constituencyName')},
        ${await this.optionalUserTextColumnSql('u', 'positionContesting')},
        ${await this.optionalUserTextColumnSql('u', 'partyName')},
        ${await this.optionalUserTextColumnSql('u', 'profilePhoto')},
        ${await this.optionalUserTextColumnSql('u', 'bio')},
        ${await this.optionalUserTextColumnSql('u', 'managedVillageId')},
        ${await this.optionalUserTextColumnSql('u', 'managedWardId')},
        u."createdAt",
        u."updatedAt"
      FROM "User" u
      WHERE u.id = ${userId}
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  private async applyProfileColumns(
    userId: string,
    updates: Partial<Record<ProfileColumn, string | null>>,
  ) {
    const existingColumns = await this.getExistingUserColumns();
    const assignments: Prisma.Sql[] = [];

    if (updates.fullName !== undefined && existingColumns.has('fullName')) {
      assignments.push(Prisma.sql`"fullName" = ${updates.fullName}`);
    }
    if (updates.phone !== undefined && existingColumns.has('phone')) {
      assignments.push(Prisma.sql`phone = ${updates.phone}`);
    }
    if (updates.email !== undefined && existingColumns.has('email')) {
      assignments.push(Prisma.sql`email = ${updates.email}`);
    }
    if (updates.officeAddress !== undefined && existingColumns.has('officeAddress')) {
      assignments.push(Prisma.sql`"officeAddress" = ${updates.officeAddress}`);
    }
    if (updates.electionLevel !== undefined && existingColumns.has('electionLevel')) {
      assignments.push(Prisma.sql`"electionLevel" = ${updates.electionLevel}`);
    }
    if (updates.constituencyName !== undefined && existingColumns.has('constituencyName')) {
      assignments.push(Prisma.sql`"constituencyName" = ${updates.constituencyName}`);
    }
    if (updates.positionContesting !== undefined && existingColumns.has('positionContesting')) {
      assignments.push(Prisma.sql`"positionContesting" = ${updates.positionContesting}`);
    }
    if (updates.partyName !== undefined && existingColumns.has('partyName')) {
      assignments.push(Prisma.sql`"partyName" = ${updates.partyName}`);
    }
    if (updates.profilePhoto !== undefined && existingColumns.has('profilePhoto')) {
      assignments.push(Prisma.sql`"profilePhoto" = ${updates.profilePhoto}`);
    }
    if (updates.bio !== undefined && existingColumns.has('bio')) {
      assignments.push(Prisma.sql`bio = ${updates.bio}`);
    }
    if (updates.managedVillageId !== undefined && existingColumns.has('managedVillageId')) {
      assignments.push(Prisma.sql`"managedVillageId" = ${updates.managedVillageId}`);
    }
    if (updates.managedWardId !== undefined && existingColumns.has('managedWardId')) {
      assignments.push(Prisma.sql`"managedWardId" = ${updates.managedWardId}`);
    }

    if (assignments.length === 0) {
      return;
    }

    assignments.push(Prisma.sql`"updatedAt" = NOW()`);

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "User" SET ${Prisma.join(assignments, ', ')} WHERE id = ${userId}`,
    );
  }

  private normalizeOptionalText(value: string | undefined) {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async optionalUserTextColumnSql(
    tableAlias: 'u',
    column: ProfileColumn,
  ): Promise<Prisma.Sql> {
    const existingColumns = await this.getExistingUserColumns();
    if (!existingColumns.has(column)) {
      return Prisma.raw(`NULL::text AS "${column}"`);
    }
    if (column === 'phone' || column === 'email' || column === 'bio') {
      return Prisma.raw(`${tableAlias}.${column} AS "${column}"`);
    }
    return Prisma.raw(`${tableAlias}."${column}" AS "${column}"`);
  }

  private async getExistingUserColumns() {
    if (this.existingUserColumnsCache) {
      return this.existingUserColumnsCache;
    }

    if (this.existingUserColumnsPromise) {
      return this.existingUserColumnsPromise;
    }

    this.existingUserColumnsPromise = (async () => {
      const rows = await this.prisma.$queryRaw<{ column_name: string }[]>(Prisma.sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User'
      `);

      const set = new Set(rows.map((row) => row.column_name));
      this.existingUserColumnsCache = set;
      this.existingUserColumnsPromise = null;
      return set;
    })();

    return this.existingUserColumnsPromise;
  }

  private isEmailConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return true;
      }
      if (error.code === 'P2010') {
        const meta = error.meta as { code?: unknown; message?: unknown } | undefined;
        const pgCode = typeof meta?.code === 'string' ? meta.code : '';
        const message = typeof meta?.message === 'string' ? meta.message : '';
        if (pgCode === '23505' && message.includes('User_email_key')) {
          return true;
        }
      }
    }

    if (error instanceof Error && error.message.includes('User_email_key')) {
      return true;
    }

    return false;
  }
}
