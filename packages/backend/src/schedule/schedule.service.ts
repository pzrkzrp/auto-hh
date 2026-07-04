import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';

@Injectable()
export class ScheduleService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  async getSchedule(userId: string) {
    const doc = await this.db.collection('user_configs').findOne({ userId });
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

    await this.db.collection('user_configs').updateOne(
      { userId },
      { $set: set },
      { upsert: true },
    );
    return this.getSchedule(userId);
  }
}
