import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto, UpdateAccessRequestDto } from './dto';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly accessRequestsService: AccessRequestsService) {}

  // Public endpoint - strict rate limiting: 3 requests per 60 seconds
  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  createRequest(@Body() body: CreateAccessRequestDto, @Ip() ip: string) {
    return this.accessRequestsService.createRequest(body, ip);
  }

  // Admin-only endpoints below
  @Get()
  @UseGuards(AuthCookieGuard, RolesGuard)
  @Roles('ADMIN')
  listRequests(@Query('status') status?: string) {
    return this.accessRequestsService.listRequests(status);
  }

  @Get('stats')
  @UseGuards(AuthCookieGuard, RolesGuard)
  @Roles('ADMIN')
  getStats() {
    return this.accessRequestsService.getStats();
  }

  @Get(':id')
  @UseGuards(AuthCookieGuard, RolesGuard)
  @Roles('ADMIN')
  getRequest(@Param('id') id: string) {
    return this.accessRequestsService.getRequestById(id);
  }

  @Patch(':id')
  @UseGuards(AuthCookieGuard, RolesGuard)
  @Roles('ADMIN')
  updateRequest(
    @Param('id') id: string,
    @Body() body: UpdateAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.accessRequestsService.updateRequestStatus(id, body, user);
  }
}
