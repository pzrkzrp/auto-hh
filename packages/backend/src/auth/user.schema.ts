import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// Пользователи веб-бэкенда. Документы пишет сам бэкенд
// (AuthService/UsersService), поэтому схема повторяет его форму:
// collection 'users', без __v, даты проставляет код.
@Schema({ collection: 'users', versionKey: false })
export class User {
  @Prop({ required: true, unique: true, sparse: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  // Зашифрованные API-ключи ({ openai?: string, anthropic?: string })
  @Prop({ type: Object, default: {} })
  apiKeys: Record<string, string>;

  @Prop({ type: String, default: null })
  activeResumeId: string | null;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // Зашифрованный storageState сессии hh.ru (HhAuthService, вход через Playwright)
  @Prop({ type: String, default: null })
  hhStorageState: string | null;

  @Prop({ type: Date, default: null })
  hhLoginAt: Date | null;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
