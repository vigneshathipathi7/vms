import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Tenant Filter Guard
 * ====================
 * 
 * Implements strict multi-tenant isolation by:
 * 1. Extracting candidateId from authenticated user
 * 2. Attaching it to request context
 * 3. Making it available to all services for automatic filtering
 * 
 * All services MUST use request.tenantId for tenant-scoped queries.
 * Cross-tenant access is IMPOSSIBLE if services follow this pattern.
 * 
 * Skip with @Public() decorator on routes that don't require tenant context.
 */

// Extend Express Request type to include tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // User should be authenticated (checked by AuthGuard first)
    const user = (request as any).user;

    // If no user, allow request through - individual route guards will handle auth
    // This allows /auth/me to return 401 properly when not authenticated
    if (!user) {
      return true;
    }

    // If user exists but no candidateId, that's an error
    if (!user.candidateId) {
      throw new ForbiddenException('Tenant context not found');
    }

    // Attach tenantId to request for all downstream services
    request.tenantId = user.candidateId;

    return true;
  }
}

