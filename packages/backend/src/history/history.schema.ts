import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HistoryDocument = HydratedDocument<History>;

// История просмотров и откликов на вакансии hh.ru.
// Документы пишет CLI (packages/cli/src/store/history-store.ts), поэтому схема
// повторяет его форму: collection 'history', без __v, поле at проставляет CLI.
@Schema({ collection: 'history', versionKey: false })
export class History {
  @Prop({ required: true, index: true })
  vacancyId: string;

  @Prop({ required: true, enum: ['seen', 'applied'], type: String })
  status: 'seen' | 'applied';

  @Prop({ required: true, type: Date })
  at: Date;

  @Prop({ type: Object, default: {} })
  meta: Record<string, any>;

  @Prop({ type: String, default: null, index: true })
  userId: string | null;
}

export const HistorySchema = SchemaFactory.createForClass(History);
