// MongoClient для БД backend'а (web-autohh). Нужен воркеру apply (--worker):
// статусы apply_queue воркер пишет в базу, которую читает фронтенд/backend,
// а не в autohh. История/дедуп остаются на основном соединении (db.ts / autohh).
import { MongoClient, Db } from "mongodb";

const URI = process.env.MONGODB_WEB_URI || 'mongodb://localhost:27017/web-autohh';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectQueueDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(URI);
  await client.connect();
  db = client.db();
  return db;
}

export function queueDbInstance(): Db {
  if (!db) throw new Error('Queue DB not connected. Call connectQueueDb() first.');
  return db;
}

export async function closeQueueDb(): Promise<void> {
  if (client) await client.close();
  client = null;
  db = null;
}
