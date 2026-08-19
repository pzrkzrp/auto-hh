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

  // Идентификатор hh-аккаунта — email или телефон, указанные при входе.
  // У одного юзера может быть несколько аккаунтов и несколько сессий на аккаунт.
  @Prop({ type: String, required: true })
  accountId: string;

  // Контакт входа, сохранённый явно: что именно было указано при логине —
  // телефон или почта. accountId дублирует его как единый ключ аккаунта
  // (email || phone), а здесь поля раздельные. Одно заполнено, второе = null.
  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: String, default: null })
  email: string | null;

  @Prop({ type: String, required: true })
  storageState: string;

  @Prop({ type: Date, default: null })
  loginAt: Date | null;
}

export const HhSessionSchema = SchemaFactory.createForClass(HhSession);

// Выборка сессий юзера (status/check/remove). Не unique — сессий на аккаунт может быть несколько.
HhSessionSchema.index({ userId: 1, accountId: 1 });
