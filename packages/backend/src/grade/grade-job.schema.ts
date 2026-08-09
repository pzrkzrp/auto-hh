import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GradeJobDocument = HydratedDocument<GradeJob>;

export type GradeStatus = 'pending' | 'completed' | 'failed';

// Задачи оценки резюме. Создаёт бэкенд (status: 'pending'), результат
// (GradeResult) заполняет воркер в поле result.
@Schema({ collection: 'grade_results', versionKey: false })
export class GradeJob {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  resumeId: string;

  @Prop({ required: true, enum: ['pending', 'completed', 'failed'], type: String, default: 'pending' })
  status: GradeStatus;

  @Prop({ type: Object, default: null })
  result: any;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const GradeJobSchema = SchemaFactory.createForClass(GradeJob);
