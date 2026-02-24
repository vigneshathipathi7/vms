import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

/**
 * MasterDataGuard
 * 
 * Prevents any write operations (POST, PATCH, PUT, DELETE) on master data routes.
 * Master data includes: District, Taluk, Village, Ward, AssemblyConstituency, ParliamentaryConstituency
 * 
 * This guard is applied to the LocationsController to ensure geographic data remains immutable.
 * All master data updates must be done via official import scripts.
 */
@Injectable()
export class MasterDataGuard implements CanActivate {
  private readonly MASTER_DATA_ROUTES = [
    '/api/v1/locations',
    '/locations',
  ];

  private readonly READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const path = request.path;

    // Check if this is a master data route
    const isMasterDataRoute = this.MASTER_DATA_ROUTES.some(route => 
      path.startsWith(route)
    );

    if (!isMasterDataRoute) {
      return true; // Not a master data route, allow
    }

    // Only allow read operations on master data routes
    if (this.READ_ONLY_METHODS.includes(method)) {
      return true;
    }

    // Block all write operations
    throw new ForbiddenException(
      'Master data is read-only. Geographic data cannot be modified via API. ' +
      'Use official import scripts for data updates.'
    );
  }
}
