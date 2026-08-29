import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
      titleKeywords: [] as string[],
      descriptionKeywords: [] as string[],
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
    resume: null as string | null,
  };

  private cacheKey(userId: string, configId: string): string {
    return `hh:config:${userId}:${configId}`;
  }

  private async clearCache(userId: string, configId: string) {
    await this.cache.del(this.cacheKey(userId, configId));
  }

  // Конфиг, принадлежащий юзеру, или null (в т.ч. для невалидного ObjectId).
  private async findOwned(userId: string, configId: string) {
    if (!Types.ObjectId.isValid(configId)) return null;
    return this.userConfigModel.findOne({ _id: configId, userId }).lean().exec();
  }

  // Конфиг по умолчанию для apply-queue/schedule: свежайший по updatedAt,
  // а если конфигов ещё нет — создаём дефолтный. Всегда возвращает id.
  async getDefaultConfigId(userId: string): Promise<string> {
    const latest = await this.userConfigModel
      .findOne({ userId })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (latest) return String(latest._id);
    return String((await this.createConfig(userId, 'Конфигурация'))._id);
  }

  // Список для страницы /config. Легаси-документ без name отображается как «Конфигурация».
  async listConfigs(userId: string) {
    const configs = await this.userConfigModel.find({ userId }).sort({ updatedAt: -1 }).lean().exec();
    return {
      configs: configs.map((c) => ({
        _id: String(c._id),
        name: c.name || 'Конфигурация',
        updatedAt: c.updatedAt,
        // Для карточки списка: активность расписания (статус «Активен»/«Пауза»)
        // и текст запроса (бейдж-тег на карточке).
        active: c.schedule?.enabled !== false,
        searchText: typeof c.search?.text === 'string' ? c.search.text : '',
      })),
    };
  }

  async createConfig(userId: string, name: string) {
    const created = await this.userConfigModel.create({
      userId,
      name,
      ...this.defaultConfig,
      updatedAt: new Date(),
    });
    return created.toObject();
  }

  async getConfig(userId: string, configId: string): Promise<any> {
    const key = this.cacheKey(userId, configId);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const doc = await this.findOwned(userId, configId);
    if (!doc) throw new NotFoundException('Config not found');
    await this.cache.set(key, doc, 60);
    return doc;
  }

  // Полное обновление: тело запроса целиком $set-ится (включая name).
  async updateConfig(userId: string, configId: string, data: any): Promise<any> {
    await this.getConfig(userId, configId); // проверка владения + 404
    const { userId: _userId, _id: _id, __v: _v, ...rest } = data || {};
    await this.userConfigModel.updateOne(
      { _id: configId, userId },
      { $set: { ...rest, updatedAt: new Date() } },
    );
    await this.clearCache(userId, configId);
    return this.getConfig(userId, configId);
  }

  async deleteConfig(userId: string, configId: string) {
    const doc = await this.findOwned(userId, configId);
    if (!doc) throw new NotFoundException('Config not found');
    await this.userConfigModel.deleteOne({ _id: configId, userId });
    await this.clearCache(userId, configId);
    return { ok: true };
  }

  async getSearchConfig(userId: string, configId: string) {
    return (await this.getConfig(userId, configId)).search;
  }

  async updateSearchConfig(userId: string, configId: string, data: any) {
    return this.updateSection(userId, configId, 'search', data);
  }

  async updateFilterConfig(userId: string, configId: string, data: any) {
    return this.updateSection(userId, configId, 'filter', data);
  }

  async updateApplyConfig(userId: string, configId: string, data: any) {
    return this.updateSection(userId, configId, 'apply', data);
  }

  async updateResumeConfig(userId: string, configId: string, resumeId: string) {
    await this.getConfig(userId, configId);
    await this.userConfigModel.updateOne(
      { _id: configId, userId },
      { $set: { resume: resumeId, updatedAt: new Date() } },
    );
    await this.clearCache(userId, configId);
    // Возвращаем полный документ, а не голый resumeId: Nest шлёт примитивные
    // string/null без JSON-сериализации (пустое тело/текст), и Angular не может
    // его распарсить (Http failure during parsing).
    return this.getConfig(userId, configId);
  }

  // Расписание лежит в том же документе конфига — dotted-path $set.
  async getScheduleConfig(userId: string, configId: string) {
    const config = await this.getConfig(userId, configId);
    return {
      cron: config?.schedule?.cron || '0 9 * * 1-5',
      enabled: config?.schedule?.enabled !== false,
    };
  }

  async updateScheduleConfig(userId: string, configId: string, data: { cron?: string; enabled?: boolean }) {
    await this.getConfig(userId, configId);
    const set: any = { updatedAt: new Date() };
    if (data.cron !== undefined) set['schedule.cron'] = data.cron;
    if (data.enabled !== undefined) set['schedule.enabled'] = data.enabled;
    await this.userConfigModel.updateOne({ _id: configId, userId }, { $set: set });
    await this.clearCache(userId, configId);
    return this.getScheduleConfig(userId, configId);
  }

  private async updateSection(userId: string, configId: string, section: string, data: any) {
    await this.getConfig(userId, configId);
    await this.userConfigModel.updateOne(
      { _id: configId, userId },
      { $set: { [section]: data, updatedAt: new Date() } },
    );
    await this.clearCache(userId, configId);
    return (await this.getConfig(userId, configId))[section];
  }
}
