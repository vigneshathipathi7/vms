import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  TRUSTED_DEVICE_COOKIE_NAME,
} from './auth.constants';
import { LoginRequestDto } from './dto/login-request.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Strict rate limiting on login: 5 attempts per 60 seconds
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body, res, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      trustedDeviceToken: req.cookies?.[TRUSTED_DEVICE_COOKIE_NAME],
    });
  }

  @Public()
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req.cookies?.[REFRESH_COOKIE_NAME], res, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(
      req.cookies?.[REFRESH_COOKIE_NAME],
      req.cookies?.[TRUSTED_DEVICE_COOKIE_NAME],
      res,
    );
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.authService.me(req.cookies?.[ACCESS_COOKIE_NAME]);
  }
}
