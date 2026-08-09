import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HhAuthController } from './hh-auth.controller';
import { HhAuthService } from './hh-auth.service';
import { User, UserSchema } from '../auth/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [HhAuthController],
  providers: [HhAuthService],
  exports: [HhAuthService],
})
export class HhAuthModule {}
