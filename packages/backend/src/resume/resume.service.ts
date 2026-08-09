import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { v5 as uuidv5 } from 'uuid';
import { ResumeDoc } from './resume.schema';
import { User } from '../auth/user.schema';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const RESUMES_DIR = path.resolve(process.env.RESUME_DIR || '../../data/resumes');

@Injectable()
export class ResumeService {
  constructor(
    @InjectModel(ResumeDoc.name) private resumeModel: Model<ResumeDoc>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  private generateId(filename: string): string {
    return uuidv5(filename, DNS_NAMESPACE);
  }

  async listResumes(userId: string) {
    return this.resumeModel.find({ userId }).sort({ createdAt: -1 }).lean().exec();
  }

  async uploadResume(userId: string, file: Express.Multer.File, name?: string) {
    const resumeName = name || path.basename(file.originalname, path.extname(file.originalname));
    const resumeId = this.generateId(file.originalname);

    if (!fs.existsSync(RESUMES_DIR)) {
      fs.mkdirSync(RESUMES_DIR, { recursive: true });
    }
    const filePath = path.join(RESUMES_DIR, resumeId);
    fs.writeFileSync(filePath, file.buffer);

    const doc = {
      resumeId,
      name: resumeName,
      filename: file.originalname,
      userId,
      createdAt: new Date(),
    };

    await this.resumeModel.updateOne(
      { resumeId, userId },
      { $setOnInsert: doc },
      { upsert: true },
    );

    return doc;
  }

  async getResumeById(userId: string, id: string) {
    const objId = this.safeObjectId(id);
    const filter: any = { userId, $or: [{ resumeId: id }] };
    if (objId) (filter.$or as any[]).push({ _id: objId });
    return this.resumeModel.findOne(filter).lean().exec();
  }

  async deleteResume(userId: string, id: string) {
    const doc = await this.getResumeById(userId, id);
    if (!doc) throw new Error('Resume not found');

    const filePath = path.join(RESUMES_DIR, doc.resumeId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.resumeModel.deleteOne({ _id: doc._id });
    return { ok: true };
  }

  async setActive(userId: string, id: string) {
    const doc = await this.getResumeById(userId, id);
    if (!doc) throw new Error('Resume not found');

    await this.userModel.updateOne(
      { _id: userId },
      { $set: { activeResumeId: doc.resumeId } },
    );
    return { ok: true };
  }

  private safeObjectId(id: string): Types.ObjectId | null {
    try {
      return new Types.ObjectId(id);
    } catch {
      return null;
    }
  }
}
