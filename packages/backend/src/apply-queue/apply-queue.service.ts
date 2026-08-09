import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { APPLY_QUEUE, ApplyJobData } from '@auto-hh/shared';
import { ApplyQueueItem, QueueStatus } from './apply-queue.schema';

export type { QueueStatus };
// Типы контракта (ApplyJobData/APPLY_QUEUE) — в packages/shared,
// единый источник правды для backend и CLI.

@Injectable()
export class ApplyQueueService {
  private readonly logger = new Logger(ApplyQueueService.name);

  constructor(
    @InjectModel(ApplyQueueItem.name) private queueModel: Model<ApplyQueueItem>,
    @InjectQueue(APPLY_QUEUE) private applyQueue: Queue<ApplyJobData>,
  ) {}

  // Постановка джобы. Mongo-запись остаётся источником статусов для фронтенда и
  // даёт дедуп; BullMQ — доставка в CLI-воркер. Redis down не роняет запрос:
  // предмет остаётся в Mongo (status: queued), в лог — warning.
  private async enqueue(item: ApplyQueueItem & { _id: Types.ObjectId }): Promise<void> {
    const payload: ApplyJobData = {
      queueId: item._id.toHexString(),
      userId: item.userId,
      vacancyId: item.vacancyId,
      title: item.title,
      employer: item.employer,
      url: item.url,
      salary: item.salary,
      area: item.area,
      score: item.score,
      coverLetter: item.coverLetter,
    };
    try {
      await this.applyQueue.add(APPLY_QUEUE, payload, {
        jobId: payload.queueId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1,
      });
    } catch (err: any) {
      this.logger.warn(`Redis недоступен, джоба не поставлена (${payload.queueId}): ${err?.message || err}`);
    }
  }

  async getQueue(userId: string, status?: QueueStatus) {
    const filter: any = { userId };
    if (status) filter.status = status;
    return this.queueModel.find(filter).sort({ addedAt: -1 }).lean().exec();
  }

  async addToQueue(userId: string, items: Array<{
    vacancyId: string;
    title: string;
    employer: string;
    url: string;
    salary: string;
    area: string;
    score: number | null;
    coverLetter: string | null;
  }>) {
    const now = new Date();
    const results: any[] = [];

    for (const item of items) {
      const doc = {
        userId,
        ...item,
        status: 'queued' as QueueStatus,
        errorMessage: null,
        addedAt: now,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const result = await this.queueModel.updateOne(
        { userId, vacancyId: doc.vacancyId, status: 'queued' },
        { $setOnInsert: doc },
        { upsert: true },
      );
      // Новый предмет — ставим джобу в BullMQ (jobId = _id).
      if (result.upsertedCount && result.upsertedId) {
        const created = await this.queueModel.findOne({ _id: result.upsertedId }).lean().exec();
        if (created) {
          results.push(created);
          await this.enqueue(created);
        }
      }
    }
    return results;
  }

  async getQueueItem(userId: string, id: string) {
    return this.queueModel.findOne({ _id: id, userId }).lean().exec();
  }

  async removeFromQueue(userId: string, id: string) {
    await this.queueModel.deleteOne({ _id: id, userId });
    try {
      await this.applyQueue.remove(id);
    } catch (err: any) {
      this.logger.warn(`Не удалось удалить джобу ${id}: ${err?.message || err}`);
    }
    return { ok: true };
  }

  async batchAction(userId: string, ids: string[], action: 'queue' | 'remove' | 'retry') {
    const objIds = ids.map(id => new Types.ObjectId(id));

    if (action === 'remove') {
      await this.queueModel.deleteMany({ _id: { $in: objIds }, userId });
      for (const id of ids) {
        try {
          await this.applyQueue.remove(id);
        } catch (err: any) {
          this.logger.warn(`Не удалось удалить джобу ${id}: ${err?.message || err}`);
        }
      }
      return { updated: ids.length };
    }

    // queue / retry: вернуть статус в 'queued' и заново поставить джобы.
    const items = await this.queueModel.find({ _id: { $in: objIds }, userId }).lean().exec();
    await this.queueModel.updateMany(
      { _id: { $in: objIds }, userId },
      { $set: { status: 'queued', updatedAt: new Date(), errorMessage: null } },
    );
    for (const item of items) await this.enqueue(item);
    return { updated: items.length };
  }
}
