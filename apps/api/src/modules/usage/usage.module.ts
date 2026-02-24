/**
 * Usage Metering Module
 * =====================
 * 
 * Tracks resource usage for monitoring and future billing:
 * - Voter counts
 * - Sub-user counts
 * - Export counts
 * - Historical usage snapshots
 */

import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
