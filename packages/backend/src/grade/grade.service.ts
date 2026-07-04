import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';

@Injectable()
export class GradeService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  private get col() {
    return this.db.collection('grade_results');
  }

  async createGradeJob(userId: string, resumeId: string) {
    const now = new Date();
    const job = {
      userId,
      resumeId,
      status: 'pending',
      result: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.col.insertOne(job as any);
    return { id: result.insertedId.toHexString(), status: 'pending' };
  }

  async getGradeJob(userId: string, id: string) {
    return this.col.findOne({ _id: new ObjectId(id), userId } as any);
  }
}
