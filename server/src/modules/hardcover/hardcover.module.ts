import { Module } from '@nestjs/common';

import { AchievementModule } from '../achievement/achievement.module';
import { HardcoverAutoSyncSchedulerService } from './hardcover-auto-sync-scheduler.service';
import { HardcoverBookMatchService } from './hardcover-book-match.service';
import { HardcoverClientService } from './hardcover-client.service';
import { HardcoverController } from './hardcover.controller';
import { HardcoverEventListener } from './hardcover-event-listener.service';
import { HardcoverQueueService } from './hardcover-queue.service';
import { HardcoverRepository } from './hardcover.repository';
import { HardcoverSettingsService } from './hardcover-settings.service';
import { HardcoverSyncService } from './hardcover-sync.service';

@Module({
  imports: [AchievementModule],
  controllers: [HardcoverController],
  providers: [
    HardcoverQueueService,
    HardcoverClientService,
    HardcoverRepository,
    HardcoverSettingsService,
    HardcoverBookMatchService,
    HardcoverSyncService,
    HardcoverAutoSyncSchedulerService,
    HardcoverEventListener,
  ],
  exports: [HardcoverSyncService, HardcoverSettingsService],
})
export class HardcoverModule {}
