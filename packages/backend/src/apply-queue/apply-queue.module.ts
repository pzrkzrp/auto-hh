import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ApplyQueueController } from './apply-queue.controller';
import { ApplyQueueService } from './apply-queue.service';
import { ApplyQueueItem, ApplyQueueItemSchema } from './apply-queue.schema';
import { ConfigModule } from '../config/config.module';

// BullMQ-очередь 'apply' — общий канал между backend и CLI. Backend кладёт
// джобы, CLI (auto-hh apply --worker) слушает ту же очередь и обрабатывает
// отклики. Имя очереди — литерал 'apply', совпадает с packages/cli.
// Соединение Redis регистрируется глобально в app.module (BullModule.forRootAsync).
@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApplyQueueItem.name, schema: ApplyQueueItemSchema }]),
    BullModule.registerQueue({ name: 'apply' }),
    // Резюме для откликов берётся из активного конфига (ConfigService).
    ConfigModule,
  ],
  controllers: [ApplyQueueController],
  providers: [ApplyQueueService],
  exports: [ApplyQueueService],
})
export class ApplyQueueModule {}
