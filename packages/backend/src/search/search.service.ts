import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';

@Injectable()
export class SearchService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  private get jobsCol() {
    return this.db.collection('search_jobs');
  }

  async createJob(userId: string) {
    const now = new Date();
    const job = {
      userId,
      status: 'pending',
      config: {},
      createdAt: now,
      completedAt: null,
      result: null,
    };
    const result = await this.jobsCol.insertOne(job as any);
    return { jobId: result.insertedId.toHexString(), status: 'pending', createdAt: now };
  }

  async getJob(userId: string, jobId: string) {
    return this.jobsCol.findOne({ _id: new ObjectId(jobId), userId } as any);
  }

  async listJobs(userId: string) {
    return this.jobsCol.find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
  }

  async getResults(userId: string, date?: string, page = 1, limit = 50) {
    const filter: any = { userId };
    if (date) filter.date = date;

    const [digestDocs, rejectedDocs] = await Promise.all([
      this.db.collection('digest').find(filter).sort({ date: -1 }).limit(1).toArray(),
      this.db.collection('rejected').find(filter).sort({ date: -1 }).limit(1).toArray(),
    ]);

    const entries = digestDocs[0]?.entries || [];
    const rejected = rejectedDocs[0]?.entries || [];
    const offset = (page - 1) * limit;

    return {
      items: entries.slice(offset, offset + limit),
      total: entries.length,
      page,
      totalPages: Math.ceil(entries.length / limit),
      rejected: rejected.slice(offset, offset + limit),
      rejectedTotal: rejected.length,
      date: digestDocs[0]?.date || date,
    };
  }
}
