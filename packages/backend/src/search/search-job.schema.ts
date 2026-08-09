import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SearchJobDocument = HydratedDocument<SearchJob>;

export type SearchJobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Задачи поиска. Создаёт бэкенд (status: 'pending'), дальше статусы
// проставляет CLI (packages/cli/src/cli/cmd-search.ts).
@Schema({ collection: 'search_jobs', versionKey: false })
export class SearchJob {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: ['pending', 'running', 'completed', 'failed'], type: String, default: 'pending' })
  status: SearchJobStatus;

  @Prop({ type: Object, default: {} })
  config: any;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Object, default: null })
  result: any;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const SearchJobSchema = SchemaFactory.createForClass(SearchJob);
SearchJobSchema.index({ userId: 1, status: 1 });
