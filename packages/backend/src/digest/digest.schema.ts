import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DigestDocument = HydratedDocument<Digest>;
export type RejectedDocument = HydratedDocument<Rejected>;

// Дайджесты и отказы пишет CLI (packages/cli/src/store/digest-store.ts),
// бэкенд только читает. Поле date — строка YYYY-MM-DD.
@Schema({ collection: 'digest', versionKey: false })
export class Digest {
  @Prop({ required: true, index: true })
  date: string;

  @Prop({ type: Object, default: [] })
  entries: any[];

  @Prop({ type: String, default: null, index: true })
  userId: string | null;
}

@Schema({ collection: 'rejected', versionKey: false })
export class Rejected {
  @Prop({ required: true, index: true })
  date: string;

  @Prop({ type: Object, default: [] })
  entries: any[];

  @Prop({ type: String, default: null, index: true })
  userId: string | null;
}

export const DigestSchema = SchemaFactory.createForClass(Digest);
export const RejectedSchema = SchemaFactory.createForClass(Rejected);
