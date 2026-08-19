import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

// Расписание лежит в документе конфига (schedule.cron / schedule.enabled).
// Конфиг по умолчанию — свежайший у юзера (ConfigService.getDefaultConfigId).
@Injectable()
export class ScheduleService {
  constructor(private readonly configService: ConfigService) {}

  async getSchedule(userId: string) {
    const configId = await this.configService.getDefaultConfigId(userId);
    return this.configService.getScheduleConfig(userId, configId);
  }

  async updateSchedule(userId: string, data: { cron?: string; enabled?: boolean }) {
    const configId = await this.configService.getDefaultConfigId(userId);
    return this.configService.updateScheduleConfig(userId, configId, data);
  }
}
