import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { VotersController } from './voters.controller';
import { VotersService } from './voters.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [VotersController],
  providers: [VotersService],
  exports: [VotersService],
})
export class VotersModule {}
