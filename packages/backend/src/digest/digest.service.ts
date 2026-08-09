import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { Digest, Rejected } from './digest.schema';

// Дайджест/отказы пишет CLI, бэкенд только читает. Чтения кэшируем в Redis
// на короткий TTL — данные обновляются редко, а повторные запросы снимают
// нагрузку с Mongo.
@Injectable()
export class DigestService {
  constructor(
    @InjectModel(Digest.name) private digestModel: Model<Digest>,
    @InjectModel(Rejected.name) private rejectedModel: Model<Rejected>,
    private readonly cache: RedisCacheService,
  ) {}

  private readonly TTL = 60;

  async getDigest(userId: string, date?: string) {
    const key = `hh:digest:${userId}:${date || 'latest'}`;
    const cached = await this.cache.get<{ date: string; entries: any[] }[]>(key);
    if (cached) return cached;

    const filter: any = { userId };
    if (date) filter.date = date;
    const docs = await this.digestModel
      .find(filter)
      .sort({ date: -1 })
      .limit(date ? 1 : 10)
      .lean()
      .exec();
    const result = docs.map(d => ({ date: d.date, entries: d.entries || [] }));
    await this.cache.set(key, result, this.TTL);
    return result;
  }

  async getLatestDigest(userId: string) {
    const docs = await this.getDigest(userId);
    return docs[0] || { date: null, entries: [] };
  }

  async getDigestDates(userId: string): Promise<string[]> {
    const key = `hh:digest:dates:${userId}`;
    const cached = await this.cache.get<string[]>(key);
    if (cached) return cached;

    const docs = await this.digestModel
      .find({ userId }, { date: 1 })
      .sort({ date: -1 })
      .lean()
      .exec();
    const result = docs.map(d => d.date);
    await this.cache.set(key, result, this.TTL);
    return result;
  }

  async getRejected(userId: string, date?: string) {
    const key = `hh:rejected:${userId}:${date || 'latest'}`;
    const cached = await this.cache.get<{ date: string; entries: any[] }[]>(key);
    if (cached) return cached;

    const filter: any = { userId };
    if (date) filter.date = date;
    const docs = await this.rejectedModel
      .find(filter)
      .sort({ date: -1 })
      .limit(date ? 1 : 10)
      .lean()
      .exec();
    const result = docs.map(d => ({ date: d.date, entries: d.entries || [] }));
    await this.cache.set(key, result, this.TTL);
    return result;
  }
}
