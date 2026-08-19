import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResumeDocDocument = HydratedDocument<ResumeDoc>;

// Резюме пользователей. Документы пишет бэкенд (ResumeService) — каждый
// аплоад создаёт новый документ (resumeId = случайный uuid, у одного и того
// же originalname разные resumeId). Класс назван ResumeDoc, чтобы не
// конфликтовать с интерфейсом Resume из shared/types.
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
// Уникальный ключ: у одного юзера не бывает двух резюме с одинаковым resumeId.
ResumeSchema.index({ resumeId: 1, userId: 1 }, { unique: true });
