import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ResumeDoc } from './resume.schema';

const RESUMES_DIR = path.resolve(process.env.RESUME_DIR || '../../data/resumes');

@Injectable()
export class ResumeService {
  constructor(
    @InjectModel(ResumeDoc.name) private resumeModel: Model<ResumeDoc>,
  ) {}

  // Случайный uuid — загрузка одного и того же файла (одинаковый originalname)
  // каждый раз создаёт новый документ резюме с уникальным resumeId.
  private generateId(): string {
    return uuidv4();
  }

  async listResumes(userId: string) {
    return this.resumeModel.find({ userId }).sort({ createdAt: -1 }).lean().exec();
  }

  // name — обязательное название резюме, введённое пользователем при загрузке
  // (валидируется в контроллере).
  async uploadResume(userId: string, file: Express.Multer.File, name: string) {
    const resumeName = name;
    const resumeId = this.generateId();

    if (!fs.existsSync(RESUMES_DIR)) {
      fs.mkdirSync(RESUMES_DIR, { recursive: true });
    }
    const filePath = path.join(RESUMES_DIR, resumeId);
    await fs.promises.writeFile(filePath, file.buffer);

    const doc = {
      resumeId,
      name: resumeName,
      filename: file.originalname,
      userId,
      createdAt: new Date(),
    };
    await this.resumeModel.create(doc);
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

  private safeObjectId(id: string): Types.ObjectId | null {
    try {
      return new Types.ObjectId(id);
    } catch {
      return null;
    }
  }
}
