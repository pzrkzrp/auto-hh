import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserConfigDocument = HydratedDocument<UserConfig>;

// Конфигурации пользователей: поиск/фильтр/отклики/адаптация/расписание.
// Collection 'user_configs'. Документы создаёт ConfigService (полный набор полей
// с дефолтами) и ScheduleService (частичный upsert только schedule.* + updatedAt),
// поэтому search/filter/apply/adaptResume необязательны — их может не быть вовсе.
@Schema({ collection: 'user_configs', versionKey: false })
export class UserConfig {
  @Prop({ required: true, unique: true, sparse: true })
  userId: string;

  // Вложенные конфиги храним как есть (Mixed) — бэкенд не разбирает их поля,
  // а только целиком $set-ит search/filter/apply из запроса.
  @Prop({ type: Object })
  search?: Record<string, any>;

  @Prop({ type: Object })
  filter?: Record<string, any>;

  @Prop({ type: Object })
  apply?: Record<string, any>;

  @Prop({ type: Boolean })
  adaptResume?: boolean;

  // Расписание обновляется через dotted-path $set: schedule.cron / schedule.enabled
  @Prop({ type: Object })
  schedule?: { cron?: string; enabled?: boolean };

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UserConfigSchema = SchemaFactory.createForClass(UserConfig);
