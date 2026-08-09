import fs from "fs";
import path from "path";
import { connect, dbInstance } from "../clients/db";
import { DigestEntry, DigestDoc } from "../types";

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function dateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function toMarkdown(entries: any[], title: string): string {
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

async function writeToMongo(collection: string, entries: any[], userId?: string): Promise<void> {
  if (!entries.length) return;
  await connect();
  const key = dateKey();
  const doc: any = { date: key, entries };
  if (userId) doc.userId = userId;
  const filter: any = { date: key };
  if (userId) filter.userId = userId;
  await dbInstance().collection(collection).updateOne(
    filter,
    { $set: doc },
    { upsert: true },
  );
}
export async function getDigestsByDate(collection: string, date: string, userId?: string): Promise<DigestEntry[]> {
  await connect();
  const filter: any = { date };
  if (userId) filter.userId = userId;
  const doc = await dbInstance().collection<DigestDoc>(collection).findOne(filter, { projection: { entries: 1 } });
  return doc?.entries || [];
}
// выводит все дайджесты без отклика
export async function getAllDigests(collection: string, userId?: string): Promise<DigestEntry[]> {
  await connect();
  const filter: any = {};
  if (userId) filter.userId = userId;
  const docs = await dbInstance().collection<DigestDoc>(collection).find(filter, { projection: { entries: 1 }, sort: { date: -1 } }).toArray();
  return docs.flatMap(d => d.entries || []);
}
export async function writeDigest(entries: any[], userId?: string): Promise<string | null> {
  if (!entries.length) return null;
  ensureDir();
  const key = dateKey();
  const md = path.join(DATA_DIR, `digest-${key}.md`);
  fs.writeFileSync(md, toMarkdown(entries, 'Дайджест вакансий'));
  await writeToMongo('digest', entries, userId);
  return md;
}

export async function writeRejected(entries: any[], userId?: string): Promise<string | null> {
  if (!entries.length) return null;
  ensureDir();
  const key = dateKey();
  const md = path.join(DATA_DIR, `rejected-${key}.md`);
  fs.writeFileSync(md, toMarkdown(entries, 'Отклонённые вакансии'));
  await writeToMongo('rejected', entries, userId);
  return md;
}
