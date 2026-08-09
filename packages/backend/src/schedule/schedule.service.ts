import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { UserConfig } from '../config/user-config.schema';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(UserConfig.name) private userConfigModel: Model<UserConfig>,
    private readonly cache: RedisCacheService,
  ) {}

  async getSchedule(userId: string) {
    const doc = await this.userConfigModel.findOne({ userId }).lean().exec();
    return {
      cron: doc?.schedule?.cron || '0 9 * * 1-5',
      enabled: doc?.schedule?.enabled !== false,
    };
  }

  async updateSchedule(userId: string, data: { cron?: string; enabled?: boolean }) {
    const set: any = {};
    if (data.cron !== undefined) set['schedule.cron'] = data.cron;
    if (data.enabled !== undefined) set['schedule.enabled'] = data.enabled;
    set.updatedAt = new Date();

    await this.userConfigModel.updateOne(
      { userId },
      { $set: set },
      { upsert: true },
    );
    // Расписание лежит в том же документе user_configs — сбрасываем кэш конфига.
    await this.cache.del(`hh:config:${userId}`);
    return this.getSchedule(userId);
  }
}
