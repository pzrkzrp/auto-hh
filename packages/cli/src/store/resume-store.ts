// MongoDB-хранилище для коллекции resumes.
import { connect, dbInstance } from "../clients/db";
import { Document } from "mongodb";
import type { Resume } from "../types.js";

export interface ResumeDoc {
  resumeId: string;
  name: string;
  filename: string;
  createdAt: Date;
  userId?: string;
}

export async function listResumes(userId?: string): Promise<ResumeDoc[]> {
  await connect();
  const filter: Document = {};
  if (userId) filter.userId = userId;
  return dbInstance().collection<ResumeDoc>('resumes')
    .find(filter, { sort: { createdAt: -1 } })
    .toArray();
}

export async function findResume(resumeId: string, userId?: string): Promise<ResumeDoc | null> {
  await connect();
  const filter: Document = { resumeId };
  if (userId) filter.userId = userId;
  return dbInstance().collection<ResumeDoc>('resumes').findOne(filter);
}

export async function registerResume(resume: Resume, userId?: string): Promise<void> {
  await connect();
  const doc: ResumeDoc = {
    resumeId: resume.id,
    name: resume.name,
    filename: resume.filename,
    createdAt: new Date(),
  };
  if (userId) doc.userId = userId;
  await dbInstance().collection<ResumeDoc>('resumes').updateOne(
    { resumeId: doc.resumeId },
    { $setOnInsert: doc },
    { upsert: true },
  );
}
