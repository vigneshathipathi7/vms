import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CaptchaService } from '../captcha/captcha.service';
import { TelegramService } from '../telegram/telegram.service';
import { AuthenticatedUser } from '../auth/types/auth.types';
import {
  CreateAccessRequestDto,
  UpdateAccessRequestAction,
  UpdateAccessRequestDto,
} from './dto';

const BCRYPT_ROUNDS = 10;
const SETUP_TOKEN_TTL_HOURS = 24;
const DEFAULT_ZONES = [
  { type: 'RED' as const, name: 'Red Zone', colorHex: '#ef4444' },
  { type: 'GREEN' as const, name: 'Green Zone', colorHex: '#22c55e' },
  { type: 'ORANGE' as const, name: 'Orange Zone', colorHex: '#f97316' },
];

@Injectable()
export class AccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly captchaService: CaptchaService,
    private readonly telegramService: TelegramService,
  ) {}

  async createRequest(payload: CreateAccessRequestDto, remoteIp?: string) {
    // Verify CAPTCHA first (if enabled)
    const captchaResult = await this.captchaService.verify(payload.captchaToken, remoteIp);
    if (!captchaResult.success) {
      throw new BadRequestException(
        'CAPTCHA verification failed. Please try again.',
      );
    }

    // Validate hierarchy based on election type
    this.validateHierarchy(payload);

    // Check if email already has a pending request
    const existingRequest = await this.prisma.accessRequest.findFirst({
      where: {
        email: payload.email,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'A pending request already exists for this email. Please wait for admin review.',
      );
    }

    // Check if email is already registered as a user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existingUser) {
      throw new ConflictException(
        'This email is already registered. Please login instead.',
      );
    }

    const request = await this.prisma.accessRequest.create({
      data: {
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        electionType: payload.electionType,
        contestingFor: payload.contestingFor,
        // Dynamic hierarchy fields
        state: payload.state,
        district: payload.district,
        constituency: payload.constituency,
        assemblyConstituency: payload.assemblyConstituency,
        taluk: payload.taluk,
        // Legacy field
        requestedTaluks: payload.requestedTaluks || [],
        partyName: payload.partyName,
        reason: payload.reason,
        bio: payload.bio,
      },
    });

    // Send Telegram notification (non-blocking)
    this.telegramService.sendAccessRequestAlert({
      fullName: request.fullName,
      phone: request.phone,
      email: request.email,
      electionType: request.electionType,
      district: request.district ?? '',
      constituency: request.constituency,
      taluk: request.taluk,
      partyName: request.partyName ?? '',
    }).catch(() => { /* ignore errors */ });

    return {
      id: request.id,
      message:
        'Your access request has been submitted successfully. You will receive credentials via email once approved.',
    };
  }

  /**
   * Validate hierarchy fields based on election type.
   */
  private validateHierarchy(payload: CreateAccessRequestDto): void {
    switch (payload.electionType) {
      case 'LOCAL_BODY':
        if (!payload.district) {
          throw new BadRequestException('district is required for LOCAL_BODY elections');
        }
        if (!payload.taluk) {
          throw new BadRequestException('taluk is required for LOCAL_BODY elections');
        }
        break;

      case 'ASSEMBLY':
        if (!payload.district) {
          throw new BadRequestException('district is required for ASSEMBLY elections');
        }
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
        break;

      default:
        throw new BadRequestException(`Unknown election type: ${payload.electionType}`);
    }
  }

  async listRequests(status?: string) {
    const where = status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {};

    const requests = await this.prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reviewedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return { items: requests };
  }

  async getRequestById(id: string) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id },
      include: {
        reviewedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    return { item: request };
  }

  async updateRequestStatus(
    id: string,
    payload: UpdateAccessRequestDto,
    actor: AuthenticatedUser,
  ) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `This request has already been ${request.status.toLowerCase()}`,
      );
    }

    const isApproval = payload.action === UpdateAccessRequestAction.APPROVE;
    const newStatus = isApproval ? 'APPROVED' : 'REJECTED';

    // For approval, we need to create Candidate and User
    if (isApproval) {
      // Check if email is still available (could have been taken since request was created)
      const existingUser = await this.prisma.user.findUnique({
        where: { email: request.email },
      });

      if (existingUser) {
        throw new ConflictException(
          'This email is already registered. Cannot approve this request.',
        );
      }

      const trimmedInitialPassword = payload.initialPassword?.trim();
      const passwordHash = trimmedInitialPassword
        ? await bcrypt.hash(trimmedInitialPassword, BCRYPT_ROUNDS)
        : null;
      const setupTokenRaw = trimmedInitialPassword ? null : randomBytes(32).toString('hex');
      const setupTokenHash = setupTokenRaw ? this.hashToken(setupTokenRaw) : null;
      const setupTokenExpiry = setupTokenRaw
        ? new Date(Date.now() + SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000)
        : null;

      // Use a transaction to create Candidate, User, and update AccessRequest atomically
      const [candidate, user, updated] = await this.prisma.$transaction(async (tx) => {
        // Create the Candidate record with dynamic hierarchy fields
        const newCandidate = await tx.candidate.create({
          data: {
            fullName: request.fullName,
            phone: request.phone,
            email: request.email,
            electionType: request.electionType,
            contestingFor: request.contestingFor,
            // Dynamic hierarchy fields
            state: request.state,
            district: request.district,
            constituency: request.constituency,
            assemblyConstituency: request.assemblyConstituency,
            partyName: request.partyName,
            bio: request.bio,
          },
        });

        // Create the ADMIN user for this candidate
        const newUser = await tx.user.create({
          data: {
            username: request.email.split('@')[0], // Use email prefix as username
            email: request.email,
            passwordHash,
            role: 'ADMIN',
            candidateId: newCandidate.id,
            fullName: request.fullName,
            phone: request.phone,
            electionLevel: this.toElectionLevelLabel(request.electionType),
            constituencyName: request.constituency ?? request.district ?? request.taluk,
            positionContesting: request.contestingFor,
            partyName: request.partyName,
            bio: request.bio,
          },
        });

        if (setupTokenHash && setupTokenExpiry) {
          await tx.passwordSetupToken.upsert({
            where: { userId: newUser.id },
            create: {
              userId: newUser.id,
              tokenHash: setupTokenHash,
              expiresAt: setupTokenExpiry,
              used: false,
            },
            update: {
              tokenHash: setupTokenHash,
              expiresAt: setupTokenExpiry,
              used: false,
            },
          });
        }

        await tx.zone.createMany({
          data: DEFAULT_ZONES.map((zone) => ({
            ...zone,
            candidateId: newCandidate.id,
          })),
          skipDuplicates: true,
        });

        // Update the access request with the new candidate reference
        const updatedRequest = await tx.accessRequest.update({
          where: { id },
          data: {
            status: newStatus,
            adminNotes: payload.adminNotes,
            reviewedAt: new Date(),
            reviewedByUserId: actor.id,
            candidateId: newCandidate.id,
          },
        });

        return [newCandidate, newUser, updatedRequest];
      });

      const frontendOrigin =
        this.configService.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5173';
      const setupLink = setupTokenRaw
        ? `${frontendOrigin.replace(/\/$/, '')}/setup-password?token=${setupTokenRaw}`
        : null;

      return {
        item: updated,
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
        },
        user: {
          id: user.id,
          email: user.email,
        },
        setupLink,
        message: setupLink
          ? `Access request approved. Share setup link with ${user.email} to set password.`
          : `Access request has been approved. Candidate "${candidate.fullName}" and admin user have been created.`,
      };
    }

    // For rejection, just update the status
    const updated = await this.prisma.accessRequest.update({
      where: { id },
      data: {
        status: newStatus,
        adminNotes: payload.adminNotes,
        reviewedAt: new Date(),
        reviewedByUserId: actor.id,
      },
    });

    return {
      item: updated,
      message: `Access request has been ${newStatus.toLowerCase()}`,
    };
  }

  async getStats() {
    const [pending, approved, rejected, total] = await this.prisma.$transaction([
      this.prisma.accessRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.accessRequest.count({ where: { status: 'APPROVED' } }),
      this.prisma.accessRequest.count({ where: { status: 'REJECTED' } }),
      this.prisma.accessRequest.count(),
    ]);

    return {
      pending,
      approved,
      rejected,
      total,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toElectionLevelLabel(electionType: string): string {
    return electionType.replace(/_/g, ' ');
  }
}
