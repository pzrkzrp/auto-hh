import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { UserConfig } from './user-config.schema';

@Injectable()
export class ConfigService {
  constructor(
    @InjectModel(UserConfig.name) private userConfigModel: Model<UserConfig>,
    private readonly cache: RedisCacheService,
  ) {}

  private defaultConfig = {
    search: {
      text: '',
      area: null as number[] | null,
      only_with_salary: false,
      per_page: 50,
      start_page: 0,
      max_pages: 5,
      schedule: null as string | null,
      employment: null as string | null,
    },
    filter: {
      requiredSkills: [] as string[],
      excludedKeywords: [] as string[],
      excludedCompanies: [] as string[],
      excludeArchived: true,
    },
    apply: {
      maxPerRun: 50,
      dryRun: false,
      minClaudeScore: 7,
      coverLetterTemplate: '',
    },
    adaptResume: true,
  };

  private cacheKey(userId: string): string {
    return `hh:config:${userId}`;
  }

  async getConfig(userId: string): Promise<any> {
    const key = this.cacheKey(userId);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const doc = await this.userConfigModel.findOne({ userId }).lean().exec();
    if (!doc) {
      const newDoc = { userId, ...this.defaultConfig, updatedAt: new Date() };
      await this.userConfigModel.create(newDoc);
      await this.cache.set(key, newDoc, 60);
      return newDoc;
    }
    await this.cache.set(key, doc, 60);
    return doc;
  }

  async updateConfig(userId: string, data: any): Promise<any> {
    const { userId: _, ...rest } = data;
    const set = { ...rest, updatedAt: new Date() };
    await this.userConfigModel.updateOne({ userId }, { $set: set }, { upsert: true });
    await this.cache.del(this.cacheKey(userId));
    return this.getConfig(userId);
  }

  async getSearchConfig(userId: string): Promise<any> {
    return (await this.getConfig(userId)).search;
  }

  async updateSearchConfig(userId: string, data: any): Promise<any> {
    await this.userConfigModel.updateOne({ userId }, { $set: { search: data, updatedAt: new Date() } }, { upsert: true });
    await this.cache.del(this.cacheKey(userId));
    return (await this.getConfig(userId)).search;
  }

  async getFilterConfig(userId: string): Promise<any> {
    return (await this.getConfig(userId)).filter;
  }

  async updateFilterConfig(userId: string, data: any): Promise<any> {
    await this.userConfigModel.updateOne({ userId }, { $set: { filter: data, updatedAt: new Date() } }, { upsert: true });
    await this.cache.del(this.cacheKey(userId));
    return (await this.getConfig(userId)).filter;
  }

  async getApplyConfig(userId: string): Promise<any> {
    return (await this.getConfig(userId)).apply;
  }

  async updateApplyConfig(userId: string, data: any): Promise<any> {
    await this.userConfigModel.updateOne({ userId }, { $set: { apply: data, updatedAt: new Date() } }, { upsert: true });
    await this.cache.del(this.cacheKey(userId));
    return (await this.getConfig(userId)).apply;
  }
}
