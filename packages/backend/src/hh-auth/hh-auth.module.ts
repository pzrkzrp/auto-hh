import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HhAuthController } from './hh-auth.controller';
import { HhAuthService } from './hh-auth.service';
import { HhSession, HhSessionSchema } from './hh-session.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: HhSession.name, schema: HhSessionSchema }])],
  controllers: [HhAuthController],
  providers: [HhAuthService],
  exports: [HhAuthService],
})
export class HhAuthModule {}
