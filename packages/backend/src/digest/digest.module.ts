import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';
import { Digest, DigestSchema, Rejected, RejectedSchema } from './digest.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Digest.name, schema: DigestSchema },
      { name: Rejected.name, schema: RejectedSchema },
    ]),
  ],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
