import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VotersModule } from '../voters/voters.module';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [AuthModule, VotersModule],
  controllers: [ZonesController],
  providers: [ZonesService],
})
export class ZonesModule {}
