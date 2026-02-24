import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

@Injectable()
export class AccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
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
      if (!payload.initialPassword) {
        throw new BadRequestException('initialPassword is required for approval');
      }

      // Check if email is still available (could have been taken since request was created)
      const existingUser = await this.prisma.user.findUnique({
        where: { email: request.email },
      });

      if (existingUser) {
        throw new ConflictException(
          'This email is already registered. Cannot approve this request.',
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(payload.initialPassword, BCRYPT_ROUNDS);

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
          },
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
        message: `Access request has been approved. Candidate "${candidate.fullName}" and admin user have been created.`,
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
}
