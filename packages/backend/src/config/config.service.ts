import { Injectable, Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { UserConfig, SearchConfig, FilterConfig, ApplyConfig } from '../shared/types';

@Injectable()
export class ConfigService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  private get col() {
    return this.db.collection('user_configs');
  }

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

  async getConfig(userId: string): Promise<any> {
    const doc = await this.col.findOne({ userId });
    if (!doc) {
      const newDoc = { userId, ...this.defaultConfig, updatedAt: new Date() };
      await this.col.insertOne(newDoc as any);
      return newDoc;
    }
    return doc;
  }

  async updateConfig(userId: string, data: any): Promise<any> {
    const { userId: _, ...rest } = data;
    const set = { ...rest, updatedAt: new Date() };
    await this.col.updateOne({ userId }, { $set: set }, { upsert: true });
    return this.getConfig(userId);
  }

  async getSearchConfig(userId: string): Promise<any> {
    return (await this.getConfig(userId)).search;
  }

  async updateSearchConfig(userId: string, data: any): Promise<any> {
    await this.col.updateOne({ userId }, { $set: { search: data, updatedAt: new Date() } }, { upsert: true });
    return (await this.getConfig(userId)).search;
  }

  async getFilterConfig(userId: string): Promise<any> {
    return (await this.getConfig(userId)).filter;
  }

  async updateFilterConfig(userId: string, data: any): Promise<any> {
    await this.col.updateOne({ userId }, { $set: { filter: data, updatedAt: new Date() } }, { upsert: true });
    return (await this.getConfig(userId)).filter;
  }

  async getApplyConfig(userId: string): Promise<any> {
    return (await this.getConfig(userId)).apply;
  }

  async updateApplyConfig(userId: string, data: any): Promise<any> {
    await this.col.updateOne({ userId }, { $set: { apply: data, updatedAt: new Date() } }, { upsert: true });
    return (await this.getConfig(userId)).apply;
  }
}
