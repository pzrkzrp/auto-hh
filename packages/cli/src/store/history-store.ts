// Хранилище истории откликов в MongoDB.
// Все методы принимают опциональный userId для мультиарендности.
import { connect, dbInstance } from "../clients/db";
import { Collection, Filter } from "mongodb";

const COLLECTION = 'history';

interface HistoryDoc {
  vacancyId: string;
  status: 'seen' | 'applied';
  at: Date;
  meta?: Record<string, unknown>;
  userId?: string | null;
}

// Что мы знаем о записи отклика. at — всегда; остальные поля приходят из meta
// (markApplied) и нужны командам (например, digestOnly — пометка, что вакансия
// в дайджесте, но отклик ещё не сделан).
export interface AppliedRecord {
  at: string;
  via?: string;
  url?: string;
  title?: string;
  employer?: string;
  score?: number;
  digestOnly?: boolean;
}

async function col(): Promise<Collection<HistoryDoc>> {
  await connect();
  return dbInstance().collection<HistoryDoc>(COLLECTION);
}

export async function load(userId?: string): Promise<{ applied: Record<string, AppliedRecord>; seen: Record<string, string> }> {
  const c = await col();
  const filter: Filter<HistoryDoc> = {};
  if (userId) filter.userId = userId;
  const docs = await c.find(filter).toArray();
  const applied: Record<string, AppliedRecord> = {};
  const seen: Record<string, string> = {};
  for (const d of docs) {
    if (d.status === 'applied') applied[d.vacancyId] = { at: d.at.toISOString() };
    seen[d.vacancyId] = d.at.toISOString();
  }
  return { applied, seen };
}

export async function markApplied(vacancyId: string, meta: Record<string, unknown>, userId?: string): Promise<void> {
  const c = await col();
  const doc: Partial<HistoryDoc> = { vacancyId: String(vacancyId), status: 'applied', at: new Date(), meta };
  if (userId) doc.userId = userId;
  await c.updateOne(
    { vacancyId: String(vacancyId) },
    { $set: doc },
    { upsert: true },
  );
}

export async function markSeen(vacancyId: string, userId?: string): Promise<void> {
  const c = await col();
  const doc: Partial<HistoryDoc> = { vacancyId: String(vacancyId), status: 'seen', at: new Date() };
  if (userId) doc.userId = userId;
  await c.updateOne(
    { vacancyId: String(vacancyId) },
    { $set: doc },
    { upsert: true },
  );
}

export async function isApplied(vacancyId: string, userId?: string): Promise<boolean> {
  const c = await col();
  const filter: Filter<HistoryDoc> = { vacancyId: String(vacancyId), status: 'applied' };
  if (userId) filter.userId = userId;
  const doc = await c.findOne(filter);
  return Boolean(doc);
}

export async function isSeen(vacancyId: string, userId?: string): Promise<boolean> {
  const c = await col();
  const filter: Filter<HistoryDoc> = { vacancyId: String(vacancyId) };
  if (userId) filter.userId = userId;
  const doc = await c.findOne(filter);
  return Boolean(doc);
}

const _default = { load, markApplied, markSeen, isApplied, isSeen };
export default _default;
