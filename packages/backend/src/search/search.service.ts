import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { SEARCH_QUEUE, SearchConfig, SearchJobPayload } from '@auto-hh/shared';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { SearchJob } from './search-job.schema';
import { Digest, Rejected } from '../digest/digest.schema';

// Типы контракта (SearchConfig/SearchJobPayload/SEARCH_QUEUE) — в packages/shared,
// единый источник правды для backend и CLI.

export interface SearchResults {
  items: any[];
  total: number;
  page: number;
  totalPages: number;
  rejected: any[];
  rejectedTotal: number;
  date: string | undefined;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(SearchJob.name) private jobsModel: Model<SearchJob>,
    @InjectModel(Digest.name) private digestModel: Model<Digest>,
    @InjectModel(Rejected.name) private rejectedModel: Model<Rejected>,
    private readonly cache: RedisCacheService,
    @InjectQueue(SEARCH_QUEUE) private searchQueue: Queue<SearchJobPayload>,
  ) {}

  // Создание search-джобы: документ в web-autohh (источник статусов для фронта)
  // + постановка джобы в BullMQ для CLI-воркера. Redis down не роняет запрос.
  async createJob(userId: string, config?: SearchConfig) {
    const now = new Date();
    const cfg = config ?? {};
    const job = {
      userId,
      status: 'pending' as const,
      config: cfg,
      createdAt: now,
      completedAt: null,
      result: null,
    };
    const created = await this.jobsModel.create(job);
    const jobId = created._id.toHexString();
    try {
      await this.searchQueue.add(SEARCH_QUEUE, { jobId, userId, config: cfg }, {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1,
      });
    } catch (err: any) {
      this.logger.warn(`Redis недоступен, джоба поиска не поставлена (${jobId}): ${err?.message || err}`);
    }
    return { jobId, status: 'pending', createdAt: now };
  }

  async getJob(userId: string, jobId: string) {
    return this.jobsModel.findOne({ _id: jobId, userId }).lean().exec();
  }

  async listJobs(userId: string) {
    return this.jobsModel.find({ userId }).sort({ createdAt: -1 }).limit(20).lean().exec();
  }

  async getResults(userId: string, date?: string, page = 1, limit = 50) {
    const key = `hh:results:${userId}:${date || 'latest'}:${page}:${limit}`;
    const cached = await this.cache.get<SearchResults>(key);
    if (cached) return cached;

    const filter: any = { userId };
    if (date) filter.date = date;

    const [digestDocs, rejectedDocs] = await Promise.all([
      this.digestModel.find(filter).sort({ date: -1 }).limit(1).lean().exec(),
      this.rejectedModel.find(filter).sort({ date: -1 }).limit(1).lean().exec(),
    ]);

    const entries = digestDocs[0]?.entries || [];
    const rejected = rejectedDocs[0]?.entries || [];
    const offset = (page - 1) * limit;

    const result = {
      items: entries.slice(offset, offset + limit),
      total: entries.length,
      page,
      totalPages: Math.ceil(entries.length / limit),
      rejected: rejected.slice(offset, offset + limit),
      rejectedTotal: rejected.length,
      date: digestDocs[0]?.date || date,
    };
    await this.cache.set(key, result, 60);
    return result;
  }
}
