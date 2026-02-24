import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ACCESS_COOKIE_NAME } from '../auth.constants';
import { AuthService } from '../auth.service';
import { RequestWithUser } from '../types/request-with-user.type';

@Injectable()
export class AuthCookieGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const accessToken = request.cookies?.[ACCESS_COOKIE_NAME];

    if (!accessToken) {
      throw new UnauthorizedException('Missing access token');
    }

    const user = await this.authService.resolveUserFromAccessToken(accessToken);
    request.user = user;

    return true;
  }
}
