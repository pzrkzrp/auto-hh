import { Global, Module } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (): Promise<Db> => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/web-autohh';
        const client = new MongoClient(uri);
        await client.connect();
        const dbName = new URL(uri).pathname.replace('/', '') || 'web-autohh';
        return client.db(dbName);
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}
