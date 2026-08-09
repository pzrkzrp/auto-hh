import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GradeJob } from './grade-job.schema';

@Injectable()
export class GradeService {
  constructor(@InjectModel(GradeJob.name) private gradeModel: Model<GradeJob>) {}

  async createGradeJob(userId: string, resumeId: string) {
    const now = new Date();
    const job = {
      userId,
      resumeId,
      status: 'pending' as const,
      result: null,
      createdAt: now,
      updatedAt: now,
    };
    const created = await this.gradeModel.create(job);
    return { id: created._id.toHexString(), status: 'pending' };
  }

  async getGradeJob(userId: string, id: string) {
    return this.gradeModel.findOne({ _id: id, userId }).lean().exec();
  }
}
