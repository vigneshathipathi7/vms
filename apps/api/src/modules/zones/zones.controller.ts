import { Controller, Get, Param, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { ListVotersQueryDto } from '../voters/dto/list-voters-query.dto';
import { ZonesService } from './zones.service';

@Controller('zones')
@UseGuards(AuthCookieGuard)
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  listZones(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.zonesService.listZones(user);
  }

  @Get(':zoneId/voters')
  listZoneVoters(
    @Param('zoneId') zoneId: string,
    @Query() query: ListVotersQueryDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.zonesService.listZoneVoters(zoneId, query, user);
  }
}
