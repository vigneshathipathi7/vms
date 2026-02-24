import { createParamDecorator, ExecutionContext, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

/**
 * Extract tenantId from request context
 * Usage: 
 *   getTenantId(@TenantId() candidateId: string)
 */
export const TenantId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.tenantId;
});

/**
 * Service to inject tenantId into all queries
 * Use this in service constructors with Inject(REQUEST)
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  constructor(@Inject(REQUEST) private request: Request) {}

  /**
   * Get current tenant ID from request context
   * Throws if not authenticated
   */
  getTenantId(): string {
    const tenantId = (this.request as any).tenantId;
    if (!tenantId) {
      throw new Error('Tenant context not available. Ensure TenantGuard is applied.');
    }
    return tenantId;
  }

  /**
   * Create a WHERE filter for tenant-scoped queries
   * Usage: 
   *   prisma.voter.findMany({
   *     where: {
   *       ...this.tenantService.getTenantFilter(),
   *       voted: true
   *     }
   *   })
   */
  getTenantFilter() {
    return {
      candidateId: this.getTenantId(),
    };
  }
}
