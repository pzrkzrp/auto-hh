import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { UserConfig, UserConfigSchema } from '../config/user-config.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserConfig.name, schema: UserConfigSchema }])],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
