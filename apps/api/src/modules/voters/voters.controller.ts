import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkMarkVotedDto } from './dto/bulk-mark-voted.dto';
import { BulkMoveZoneDto } from './dto/bulk-move-zone.dto';
import { CreateVoterDto } from './dto/create-voter.dto';
import { ListVotersQueryDto } from './dto/list-voters-query.dto';
import { UpdateVoterDto } from './dto/update-voter.dto';
import { VotersService } from './voters.service';

@Controller('voters')
@UseGuards(AuthCookieGuard, RolesGuard)
export class VotersController {
  constructor(private readonly votersService: VotersService) {}

  @Get()
  listVoters(
    @Query() query: ListVotersQueryDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.listVoters(query, user);
  }

  @Get('voted')
  listVotedVoters(
    @Query() query: ListVotersQueryDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.getVotedVoters(query, user);
  }

  @Get('filter-options')
  filterOptions(
    @Query() query: ListVotersQueryDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.getFilterOptions({ zoneId: query.zoneId }, user);
  }

  // CSV export rate limited to 5 per minute
  @Get('export.csv')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async exportCsv(
    @Query() query: ListVotersQueryDto,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    const csv = await this.votersService.exportVotersCsv(query, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"voters.csv\"');
    res.send(csv);
  }

  @Post()
  createVoter(
    @Body() body: CreateVoterDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.createVoter(body, user);
  }

  @Patch(':id')
  updateVoter(
    @Param('id') id: string,
    @Body() body: UpdateVoterDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.updateVoter(id, body, user);
  }

  @Delete(':id')
  deleteVoter(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.deleteVoter(id, user);
  }

  @Post('bulk/mark-voted')
  bulkMarkVoted(
    @Body() body: BulkMarkVotedDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.bulkMarkVoted(body, user);
  }

  @Post('bulk/move-zone')
  @Roles('ADMIN', 'SUPER_ADMIN')
  bulkMoveZone(
    @Body() body: BulkMoveZoneDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.bulkMoveZone(body, user);
  }

  @Post('bulk/delete')
  @Roles('ADMIN', 'SUPER_ADMIN')
  bulkDelete(@Body() body: BulkDeleteDto, @CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.votersService.bulkDelete(body, user);
  }
}
