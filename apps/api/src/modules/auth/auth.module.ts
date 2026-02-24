import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieGuard } from './guards/auth-cookie.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantGuard } from './guards/tenant.guard';
import { TenantService } from './services/tenant.service';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => AuditModule)],
  controllers: [AuthController],
  providers: [AuthService, AuthCookieGuard, RolesGuard, TenantGuard, TenantService],
  exports: [AuthService, AuthCookieGuard, RolesGuard, TenantGuard, TenantService],
})
export class AuthModule { }
