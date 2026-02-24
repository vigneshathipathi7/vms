import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from '../audit/audit.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [ScheduleModule.forRoot(), AuditModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
