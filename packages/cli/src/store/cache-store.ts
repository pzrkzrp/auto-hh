// Кэш в отдельных MongoDB коллекциях: cachePages, cacheFull, cacheJudgements, cacheCoverLetters.
import { connect, dbInstance } from "../clients/db";
import { Document } from "mongodb";
import type { Vacancy, Verdict } from "../types.js";

function dateKey(d?: Date): string {
  return (d || new Date()).toISOString().slice(0, 10);
}

export interface CacheDoc {
  date: string;
  pages: Record<string, Vacancy[]>;
  fullById: Record<string, Vacancy>;
  judgements: Record<string, Verdict>;
  coverLetters: Record<string, string>;
}

export async function load(date?: Date, resumeId?: string, userId?: string): Promise<CacheDoc> {
  await connect();
  const db = dbInstance();
  const key = dateKey(date);

  const baseFilter: { userId?: string } = {};
  if (userId) baseFilter.userId = userId;

  const judgeFilter: { date: string; resumeId?: string; userId?: string } = { date: key, ...baseFilter };
  const coverFilter: { resumeId?: string; userId?: string } = { ...baseFilter };
  if (resumeId) {
    judgeFilter.resumeId = resumeId;
    coverFilter.resumeId = resumeId;
  }

  const [pageDocs, fullDocs, judgeDocs, coverDocs] = await Promise.all([
    db.collection('cachePages').find({ date: key }).toArray(),
    db.collection('cacheFull').find({ date: key }).toArray(),
    db.collection('cacheJudgements').find(judgeFilter).toArray(),
    db.collection('cacheCoverLetters').find(coverFilter).toArray(),
  ]);

  const pages: Record<string, Vacancy[]> = {};
  for (const d of pageDocs) pages[String(d.page)] = d.items;

  const fullById: Record<string, Vacancy> = {};
  for (const d of fullDocs) fullById[d.vacancyId] = d.full;

  const judgements: Record<string, Verdict> = {};
  for (const d of judgeDocs) {
    const vacancyId = String(d.vacancyId);
    judgements[vacancyId] = {
      vacancyId,
      fit: Boolean(d.fit),
      score: Number(d.score),
      reason: d.reason ?? null,
      comment: d.comment ?? null,
      coverLetter: d.coverLetter ?? '',
    };
  }

  const coverLetters: Record<string, string> = {};
  for (const d of coverDocs) coverLetters[d.vacancyId] = d.letter;

  return { date: key, pages, fullById, judgements, coverLetters };
}

export async function savePage(state: CacheDoc, pageNum: number, date?: Date, userId?: string): Promise<void> {
  await connect();
  const doc: Document = { date: dateKey(date), page: pageNum, items: state.pages?.[String(pageNum)] || [] };
  if (userId) doc.userId = userId;
  await dbInstance().collection('cachePages').updateOne(
    { date: dateKey(date), page: pageNum },
    { $set: doc },
    { upsert: true },
  );
}

export async function saveFull(state: CacheDoc, vacancyId: string, date?: Date, userId?: string): Promise<void> {
  await connect();
  const doc: Document = { date: dateKey(date), vacancyId: String(vacancyId), full: state.fullById?.[String(vacancyId)] };
  if (userId) doc.userId = userId;
  await dbInstance().collection('cacheFull').updateOne(
    { vacancyId: String(vacancyId) },
    { $set: doc },
    { upsert: true },
  );
}

export async function saveJudgements(state: CacheDoc, resumeId?: string, date?: Date, userId?: string): Promise<void> {
  await connect();
  const db = dbInstance();
  const key = dateKey(date);
  const coll = db.collection('cacheJudgements');
  const filter: { date: string; resumeId?: string; userId?: string } = { date: key };
  if (resumeId) filter.resumeId = resumeId;
  if (userId) filter.userId = userId;
  await coll.deleteMany(filter);
  const docs = Object.entries(state.judgements || {}).map(([vid, j]) => ({
    date: key, resumeId: resumeId || null, vacancyId: vid, score: j.score, fit: j.fit,
    reason: j.reason, comment: j.comment, userId: userId || null,
  }));
  if (docs.length) await coll.insertMany(docs);
}

export async function saveCoverLetter(state: CacheDoc, vacancyId: string, resumeId?: string, date?: Date, userId?: string): Promise<void> {
  await connect();
  const filter: Document = { vacancyId: String(vacancyId) };
  if (resumeId) filter.resumeId = resumeId;
  if (userId) filter.userId = userId;
  const doc: Document = { date: dateKey(date), resumeId: resumeId || null, vacancyId: String(vacancyId), letter: state.coverLetters?.[String(vacancyId)] || '' };
  if (userId) doc.userId = userId;
  await dbInstance().collection('cacheCoverLetters').updateOne(
    filter,
    { $set: doc },
    { upsert: true },
  );
}

export async function clear(): Promise<string[]> {
  await connect();
  const db = dbInstance();
  const collections = ['cachePages', 'cacheFull', 'cacheJudgements', 'cacheCoverLetters'];
  const removed: string[] = [];
  for (const coll of collections) {
    const r = await db.collection(coll).deleteMany({});
    if (r.deletedCount) removed.push(`${coll}: ${r.deletedCount}`);
  }
  return removed;
}

export function fileFor(date?: Date): string {
  return `cache:${dateKey(date)}`;
}
