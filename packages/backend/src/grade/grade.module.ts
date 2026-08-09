import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GradeController } from './grade.controller';
import { GradeService } from './grade.service';
import { GradeJob, GradeJobSchema } from './grade-job.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: GradeJob.name, schema: GradeJobSchema }])],
  controllers: [GradeController],
  providers: [GradeService],
})
export class GradeModule {}
