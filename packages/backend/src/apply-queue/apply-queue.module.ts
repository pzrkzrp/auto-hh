import { Module } from '@nestjs/common';
import { ApplyQueueController } from './apply-queue.controller';
import { ApplyQueueService } from './apply-queue.service';

@Module({
  controllers: [ApplyQueueController],
  providers: [ApplyQueueService],
  exports: [ApplyQueueService],
})
export class ApplyQueueModule {}
