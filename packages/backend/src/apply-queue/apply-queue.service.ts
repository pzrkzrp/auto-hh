import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';

export type QueueStatus = 'queued' | 'processing' | 'success' | 'failed' | 'skipped';

@Injectable()
export class ApplyQueueService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  private get col() {
    return this.db.collection('apply_queue');
  }

  async getQueue(userId: string, status?: QueueStatus) {
    const filter: any = { userId };
    if (status) filter.status = status;
    return this.col.find(filter).sort({ addedAt: -1 }).toArray();
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
      const result = await this.col.updateOne(
        { userId, vacancyId: doc.vacancyId, status: 'queued' },
        { $setOnInsert: doc },
        { upsert: true },
      );
      if (result.upsertedCount && result.upsertedId) {
        results.push(await this.col.findOne({ _id: result.upsertedId } as any));
      }
    }
    return results;
  }

  async getQueueItem(userId: string, id: string) {
    return this.col.findOne({ _id: new ObjectId(id), userId } as any);
  }

  async removeFromQueue(userId: string, id: string) {
    await this.col.deleteOne({ _id: new ObjectId(id), userId } as any);
    return { ok: true };
  }

  async batchAction(userId: string, ids: string[], action: 'queue' | 'remove' | 'retry') {
    const objIds = ids.map(id => new ObjectId(id));

    if (action === 'remove') {
      await this.col.deleteMany({ _id: { $in: objIds }, userId } as any);
      return { updated: ids.length };
    }

    const result = await this.col.updateMany(
      { _id: { $in: objIds }, userId } as any,
      { $set: { status: 'queued', updatedAt: new Date(), errorMessage: null } },
    );
    return { updated: result.modifiedCount };
  }
}
