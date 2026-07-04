// Хранилище истории откликов в MongoDB.
// Все методы принимают опциональный userId для мультиарендности.
import { connect, dbInstance } from "./db";
import { Collection } from "mongodb";

const COLLECTION = 'history';

interface HistoryDoc {
  vacancyId: string;
  status: 'seen' | 'applied';
  at: Date;
  meta?: Record<string, any>;
  userId?: string | null;
}

async function col(): Promise<Collection<HistoryDoc>> {
  await connect();
  return dbInstance().collection<HistoryDoc>(COLLECTION);
}

export async function load(userId?: string): Promise<{ applied: Record<string, any>; seen: Record<string, string> }> {
  const c = await col();
  const filter: any = {};
  if (userId) filter.userId = userId;
  const docs = await c.find(filter).toArray();
  const applied: Record<string, any> = {};
  const seen: Record<string, string> = {};
  for (const d of docs) {
    if (d.status === 'applied') applied[d.vacancyId] = { at: d.at.toISOString(), ...d.meta };
    seen[d.vacancyId] = d.at.toISOString();
  }
  return { applied, seen };
}

export async function markApplied(vacancyId: string, meta: Record<string, any>, userId?: string): Promise<void> {
  const c = await col();
  const doc: any = { vacancyId: String(vacancyId), status: 'applied', at: new Date(), meta };
  if (userId) doc.userId = userId;
  await c.updateOne(
    { vacancyId: String(vacancyId) },
    { $set: doc },
    { upsert: true },
  );
}

export async function markSeen(vacancyId: string, userId?: string): Promise<void> {
  const c = await col();
  const doc: any = { vacancyId: String(vacancyId), status: 'seen', at: new Date() };
  if (userId) doc.userId = userId;
  await c.updateOne(
    { vacancyId: String(vacancyId) },
    { $set: doc },
    { upsert: true },
  );
}

export async function isApplied(vacancyId: string, userId?: string): Promise<boolean> {
  const c = await col();
  const filter: any = { vacancyId: String(vacancyId), status: 'applied' };
  if (userId) filter.userId = userId;
  const doc = await c.findOne(filter);
  return Boolean(doc);
}

export async function isSeen(vacancyId: string, userId?: string): Promise<boolean> {
  const c = await col();
  const filter: any = { vacancyId: String(vacancyId) };
  if (userId) filter.userId = userId;
  const doc = await c.findOne(filter);
  return Boolean(doc);
}

const _default = { load, markApplied, markSeen, isApplied, isSeen };
export default _default;
