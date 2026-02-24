import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthCookieGuard } from '../auth/guards/auth-cookie.guard';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthCookieGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.dashboardService.getStats(user);
  }
}
