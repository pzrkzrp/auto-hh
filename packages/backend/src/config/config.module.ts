import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { UserConfig, UserConfigSchema } from './user-config.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserConfig.name, schema: UserConfigSchema }])],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
