import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';

@Injectable()
export class HistoryService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  async getHistory(userId: string, params: { status?: string; limit?: number; offset?: number } = {}) {
    const filter: any = { userId };
    if (params.status) filter.status = params.status;
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const [items, total] = await Promise.all([
      this.db.collection('history')
        .find(filter)
        .sort({ at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      this.db.collection('history').countDocuments(filter),
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
      this.db.collection('history').countDocuments({ userId, status: 'applied' }),
      this.db.collection('history').countDocuments({ userId, status: 'seen' }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const [todayApplied, todaySeen] = await Promise.all([
      this.db.collection('history').countDocuments({ userId, status: 'applied', at: { $gte: todayStart } }),
      this.db.collection('history').countDocuments({ userId, status: 'seen', at: { $gte: todayStart } }),
    ]);

    return {
      totalApplied: appliedTotal,
      totalSeen: seenTotal,
      todayApplied,
      todaySeen,
    };
  }
}
