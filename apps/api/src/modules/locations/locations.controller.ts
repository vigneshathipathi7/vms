import { Controller, Get, Param, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(AuthCookieGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * Get all unique districts (SHARED globally).
   */
  @Get('districts')
  getDistricts(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.locationsService.getDistricts();
  }

  /**
   * Get all taluks grouped by district (SHARED globally).
   */
  @Get('taluks')
  getTaluksByDistrict(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.locationsService.getTaluksByDistrict();
  }

  /**
   * Get taluks list - flat, optionally filtered (SHARED globally).
   */
  @Get('taluks/list')
  getTaluks(
    @Query('ids') ids: string | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    const talukIds = ids ? ids.split(',').filter(Boolean) : undefined;
    return this.locationsService.getTaluks(talukIds);
  }

  /**
   * Get villages in a taluk (SHARED globally).
   */
  @Get('taluks/:talukId/villages')
  getVillages(
    @Param('talukId') talukId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.locationsService.getVillages(talukId);
  }

  /**
   * Get wards in a village (SHARED globally).
   */
  @Get('villages/:villageId/wards')
  getWards(
    @Param('villageId') villageId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.locationsService.getWards(villageId);
  }

  /**
   * Get all zones for the current candidate (TENANT-SCOPED).
   */
  @Get('zones')
  getZones(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.locationsService.getZones(user);
  }
}
