import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchJob, SearchJobSchema } from './search-job.schema';
import { Digest, DigestSchema, Rejected, RejectedSchema } from '../digest/digest.schema';

// BullMQ-очередь 'search' — общий канал между backend и CLI. Backend по
// POST /api/search/jobs кладёт джобу, CLI (auto-hh search --worker) слушает
// очередь и выполняет поиск. Имя очереди — литерал 'search', совпадает с packages/cli.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SearchJob.name, schema: SearchJobSchema },
      { name: Digest.name, schema: DigestSchema },
      { name: Rejected.name, schema: RejectedSchema },
    ]),
    BullModule.registerQueue({ name: 'search' }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
