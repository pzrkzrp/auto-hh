import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule as UserConfigModule } from './config/config.module';
import { DigestModule } from './digest/digest.module';
import { HistoryModule } from './history/history.module';
import { ApplyQueueModule } from './apply-queue/apply-queue.module';
import { ResumeModule } from './resume/resume.module';
import { SearchModule } from './search/search.module';
import { GradeModule } from './grade/grade.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    UserConfigModule,
    DigestModule,
    HistoryModule,
    ApplyQueueModule,
    ResumeModule,
    SearchModule,
    GradeModule,
    ScheduleModule,
  ],
})
export class AppModule {}
