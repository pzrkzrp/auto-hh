import fs from "fs";
import path from "path";
import { Db, Document } from "mongodb";
import { connect, dbInstance } from "../clients/db";
import { DigestEntry, DigestDoc } from "../types";

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Общие поля строки дайджеста/отклонённых. score/reason/comment/coverLetter
// могут отсутствовать (например, у отклонённых нет письма).
export interface DigestRow {
  title: string;
  employer: string;
  area: string;
  salary: string;
  url: string;
  score?: number | null;
  reason?: string | null;
  comment?: string | null;
  coverLetter?: string;
}

function dateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function toMarkdown(entries: DigestRow[], title: string): string {
  const lines: string[] = [`# ${title} — ${dateKey()} (${entries.length} вакансий)\n`];
  for (const e of entries) {
    lines.push(`---`);
    lines.push(`**${e.title || '—'}** @ ${e.employer || '—'}`);
    lines.push(`- Регион: ${e.area || '—'}`);
    lines.push(`- Зарплата: ${e.salary || '—'}`);
    if (e.score != null) lines.push(`- Оценка: ${e.score}/10`);
    if (e.reason) lines.push(`- Причина: ${e.reason}`);
    if (e.comment) lines.push(`- Совпадение: ${e.comment}`);
    if (e.url) lines.push(`- Ссылка: ${e.url}`);
    if (e.coverLetter) {
      lines.push(`\n**Сопроводительное:**\n\n${e.coverLetter}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function writeToMongo(collection: string, entries: DigestRow[], userId?: string, targetDb?: Db): Promise<void> {
  if (!entries.length) return;
  // targetDb — база backend'а (web-autohh) для поиска из веба; иначе autohh.
  const db = targetDb ?? (await connect());
  const key = dateKey();
  const doc: Document = { date: key, entries };
  if (userId) doc.userId = userId;
  const filter: Document = { date: key };
  if (userId) filter.userId = userId;
  await db.collection(collection).updateOne(
    filter,
    { $set: doc },
    { upsert: true },
  );
}
export async function getDigestsByDate(collection: string, date: string, userId?: string): Promise<DigestEntry[]> {
  await connect();
  const filter: Document = { date };
  if (userId) filter.userId = userId;
  const doc = await dbInstance().collection<DigestDoc>(collection).findOne(filter, { projection: { entries: 1 } });
  return doc?.entries || [];
}
// выводит все дайджесты без отклика
export async function getAllDigests(collection: string, userId?: string): Promise<DigestEntry[]> {
  await connect();
  const filter: Document = {};
  if (userId) filter.userId = userId;
  const docs = await dbInstance().collection<DigestDoc>(collection).find(filter, { projection: { entries: 1 }, sort: { date: -1 } }).toArray();
  return docs.flatMap(d => d.entries || []);
}
export async function writeDigest(entries: DigestEntry[], userId?: string, targetDb?: Db): Promise<string | null> {
  if (!entries.length) return null;
  ensureDir();
  const key = dateKey();
  const md = path.join(DATA_DIR, `digest-${key}.md`);
  // Локальный .md пишем только в ручном режиме (без targetDb); веб-запуски пишут в web-autohh.
  if (!targetDb) {
    await fs.promises.writeFile(md, toMarkdown(entries, 'Дайджест вакансий'));
  }
  await writeToMongo('digest', entries, userId, targetDb);
  return md;
}

export async function writeRejected(entries: DigestRow[], userId?: string, targetDb?: Db): Promise<string | null> {
  if (!entries.length) return null;
  ensureDir();
  const key = dateKey();
  const md = path.join(DATA_DIR, `rejected-${key}.md`);
  if (!targetDb) {
    await fs.promises.writeFile(md, toMarkdown(entries, 'Отклонённые вакансии'));
  }
  await writeToMongo('rejected', entries, userId, targetDb);
  return md;
}
