import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserConfigDocument = HydratedDocument<UserConfig>;

// Конфигурации пользователей: поиск/фильтр/отклики/адаптация/расписание.
// Collection 'user_configs'. У одного юзера может быть несколько конфигов
// (профилей поиска/откликов) — каждый со своим name. Активный выбирается на
// странице списка и используется apply-queue (резюме) и schedule (расписание).
// Документы создаёт ConfigService (полный набор полей с дефолтами),
// поэтому search/filter/apply/adaptResume необязательны — их может не быть вовсе.
@Schema({ collection: 'user_configs', versionKey: false })
export class UserConfig {
  @Prop({ required: true })
  userId: string;

  // Имя конфига для списка (задаётся при создании/редактировании).
  @Prop({ type: String })
  name?: string;

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

  // Активное резюме для откликов — resumeId из коллекции resumes.
  // Выбирается на странице конфигурации (вкладка «Резюме»).
  @Prop({ type: String, default: null })
  resume?: string | null;

  // Расписание обновляется через dotted-path $set: schedule.cron / schedule.enabled
  @Prop({ type: Object })
  schedule?: { cron?: string; enabled?: boolean };

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UserConfigSchema = SchemaFactory.createForClass(UserConfig);
// Конфигов на юзера несколько — индекс простой (не unique).
UserConfigSchema.index({ userId: 1 });
