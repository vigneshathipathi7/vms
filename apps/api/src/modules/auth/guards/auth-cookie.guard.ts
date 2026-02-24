import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ACCESS_COOKIE_NAME } from '../auth.constants';
import { AuthService } from '../auth.service';
import { RequestWithUser } from '../types/request-with-user.type';

@Injectable()
export class AuthCookieGuard implements CanActivate {
  constructor(private readonly moduleRef: ModuleRef) {}

  private getAuthService() {
    return this.moduleRef.get(AuthService, { strict: false });
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const accessToken = request.cookies?.[ACCESS_COOKIE_NAME];

    if (!accessToken) {
      throw new UnauthorizedException('Missing access token');
    }

    const authService = this.getAuthService();
    const user = await authService.resolveUserFromAccessToken(accessToken);
    request.user = user;

    return true;
  }
}
