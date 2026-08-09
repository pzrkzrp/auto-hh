import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as EnvConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from './common/redis/redis.module';
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
import { HhAuthModule } from './hh-auth/hh-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Mongoose — ORM для всех моделей. Все сервисы работают через
    // @nestjs/mongoose (нативный драйвер больше не используется).
    MongooseModule.forRootAsync({
      inject: [EnvConfigService],
      useFactory: (config: EnvConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/web-autohh',
      }),
    }),
    // BullMQ — Redis-очереди для CLI-воркеров (apply, search). Соединение
    // глобальное, фичевые модули регистрируют свои очереди через registerQueue.
    BullModule.forRootAsync({
      inject: [EnvConfigService],
      useFactory: (config: EnvConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') || 'redis://localhost:6379' },
      }),
    }),
    RedisModule,
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
    HhAuthModule,
  ],
})
export class AppModule {}
