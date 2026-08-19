import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApplyQueueItemDocument = HydratedDocument<ApplyQueueItem>;

export type QueueStatus = 'queued' | 'processing' | 'success' | 'failed' | 'skipped';

// Очередь откликов на вакансии. Создаёт бэкенд (status: 'queued'), статусы
// проставляет CLI (packages/cli/src/cli/cmd-apply.ts). Дубликаты исключаются
// upsert-ом с $setOnInsert по ключу { userId, vacancyId, status: 'queued' }.
@Schema({ collection: 'apply_queue', versionKey: false })
export class ApplyQueueItem {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: String, default: null })
  resumeId: string | null;

  @Prop({ required: true })
  vacancyId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  employer: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  salary: string;

  @Prop({ required: true })
  area: string;

  @Prop({ type: Number, default: null })
  score: number | null;

  @Prop({ type: String, default: null })
  coverLetter: string | null;

  @Prop({ required: true, enum: ['queued', 'processing', 'success', 'failed', 'skipped'], type: String, default: 'queued' })
  status: QueueStatus;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  @Prop({ type: Date })
  addedAt: Date;

  @Prop({ type: Date, default: null })
  processedAt: Date | null;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const ApplyQueueItemSchema = SchemaFactory.createForClass(ApplyQueueItem);
ApplyQueueItemSchema.index({ userId: 1, status: 1 });
