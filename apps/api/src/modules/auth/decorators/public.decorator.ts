import { SetMetadata } from '@nestjs/common';

/**
 * Mark route/controller as public (skip TenantGuard)
 * Usage:
 *   @Public()
 *   @Post('login')
 *   login() { }
 */
export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
