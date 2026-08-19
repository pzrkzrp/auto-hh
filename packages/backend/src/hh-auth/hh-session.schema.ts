import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HhSessionDocument = HydratedDocument<HhSession>;

// Сессия hh.ru: зашифрованный Playwright storageState (cookies + localStorage)
// после входа через HhAuthService. Отдельная коллекция, а не поле в User, чтобы
// не раздувать пользователя и позволить хранить несколько подключений/аккаунтов.
// storageState шифруется AES-256-GCM (ENCRYPTION_KEY) перед записью.
@Schema({ collection: 'hh_sessions', versionKey: false, timestamps: true })
export class HhSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  storageState: string;

  @Prop({ type: Date, default: null })
  loginAt: Date | null;
}

export const HhSessionSchema = SchemaFactory.createForClass(HhSession);
