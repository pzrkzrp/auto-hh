import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResumeDocDocument = HydratedDocument<ResumeDoc>;

// Резюме пользователей. Документы пишет бэкенд (ResumeService) — upsert
// с $setOnInsert по ключу { resumeId, userId }. Класс назван ResumeDoc,
// чтобы не конфликтовать с интерфейсом Resume из shared/types.
@Schema({ collection: 'resumes', versionKey: false })
export class ResumeDoc {
  @Prop({ required: true })
  resumeId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: Date })
  createdAt: Date;
}

export const ResumeSchema = SchemaFactory.createForClass(ResumeDoc);
// Уникальный ключ совпадает с фильтром upsert в ResumeService.uploadResume
ResumeSchema.index({ resumeId: 1, userId: 1 }, { unique: true });
