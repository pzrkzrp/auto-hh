import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { History } from './history.schema';

@Injectable()
export class HistoryService {
  constructor(@InjectModel(History.name) private historyModel: Model<History>) {}

  async getHistory(userId: string, params: { status?: string; limit?: number; offset?: number } = {}) {
    const filter: any = { userId };
    if (params.status) filter.status = params.status;
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const [items, total] = await Promise.all([
      this.historyModel.find(filter).sort({ at: -1 }).skip(offset).limit(limit).exec(),
      this.historyModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map(i => ({
        id: i._id.toHexString(),
        vacancyId: i.vacancyId,
        status: i.status,
        at: i.at,
        meta: i.meta || {},
      })),
      total,
      hasMore: offset + limit < total,
    };
  }

  async getStats(userId: string) {
    const [appliedTotal, seenTotal] = await Promise.all([
      this.historyModel.countDocuments({ userId, status: 'applied' }).exec(),
      this.historyModel.countDocuments({ userId, status: 'seen' }).exec(),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const [todayApplied, todaySeen] = await Promise.all([
      this.historyModel.countDocuments({ userId, status: 'applied', at: { $gte: todayStart } }).exec(),
      this.historyModel.countDocuments({ userId, status: 'seen', at: { $gte: todayStart } }).exec(),
    ]);

    return {
      totalApplied: appliedTotal,
      totalSeen: seenTotal,
      todayApplied,
      todaySeen,
    };
  }
}
