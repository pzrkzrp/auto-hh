import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { DigestEntry } from '../shared/types';

@Injectable()
export class DigestService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  private getCol(name: string) {
    return this.db.collection(name);
  }

  async getDigest(userId: string, date?: string) {
    const filter: any = { userId };
    if (date) filter.date = date;
    const docs = await this.getCol('digest')
      .find(filter)
      .sort({ date: -1 })
      .limit(date ? 1 : 10)
      .toArray();
    return docs.map(d => ({ date: d.date, entries: d.entries || [] }));
  }

  async getLatestDigest(userId: string) {
    const docs = await this.getDigest(userId);
    return docs[0] || { date: null, entries: [] };
  }

  async getDigestDates(userId: string): Promise<string[]> {
    const docs = await this.getCol('digest')
      .find({ userId }, { projection: { date: 1 } })
      .sort({ date: -1 })
      .toArray();
    return docs.map(d => d.date);
  }

  async getRejected(userId: string, date?: string) {
    const filter: any = { userId };
    if (date) filter.date = date;
    const docs = await this.getCol('rejected')
      .find(filter)
      .sort({ date: -1 })
      .limit(date ? 1 : 10)
      .toArray();
    return docs.map(d => ({ date: d.date, entries: d.entries || [] }));
  }
}
