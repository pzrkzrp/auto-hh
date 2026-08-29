// Команда search: поиск, фильтр, Claude → дайджест.
import { Worker } from "bullmq";
import { ObjectId, Document } from "mongodb";
import { SEARCH_QUEUE } from "@auto-hh/shared";
import type { SearchConfig, SearchJobPayload } from "@auto-hh/shared";

import type { DigestEntry, Resume, Vacancy, Verdict } from "../types.js";
import type { CacheDoc } from "../store/cache-store.js";

import HHClient from "../clients/hh-client";
import { connect, dbInstance, close as closeDb } from "../clients/db";
import { connectQueueDb, queueDbInstance, closeQueueDb } from "../clients/queue-db";
import { loadConfig } from "../config";
import { vacancyMatchesFilter } from "../domain/filter.js";
import { buildCoverLetter, buildCoverLettersBatch } from "../domain/cover-letter";
import { judgeVacanciesBatch } from "../domain/judge";
import log from "../logger.js";
import { loadResume } from "../resume.js";
import * as collectCache from "../store/cache-store.js";
import { writeDigest, writeRejected } from "../store/digest-store";
import history from "../store/history-store";
import resetData from "../store/reset.js";
import { registerResume } from "../store/resume-store.js";
import { errMsg } from "../utils/errors.js";

// cfg на входе пайплайна: SearchConfig (контракт backend↔CLI) + локальный блок api.
type PipelineConfig = SearchConfig & { api?: { apiKey?: string } };

// Параметры HTTP-запроса к hh.ru /search/vacancy (строятся из SearchConfig.search).
interface SearchParams {
  text?: string;
  area?: number[];
  experience?: string;
  salary?: number;
  only_with_salary?: boolean;
  currency?: string;
  per_page?: number;
  page?: number;
  schedule?: string | null;
  employment?: string | null;
}

// Опции команды `auto-hh search` (commander). Совпадают с флагами в index.ts.
interface SearchCliOpts {
  config?: string;
  reset?: boolean;
  worker?: boolean;
  job?: string;
  user?: string;
  resume?: string;
  dryRun?: boolean;
  claude?: boolean;
}

// Параметры пайплайна: подмножество CLI-опций + режим записи статусов/дайджеста.
type PipelineOpts = Pick<SearchCliOpts, 'job' | 'user' | 'resume' | 'dryRun' | 'claude'> & {
  useWebDb?: boolean; // true → статусы/дайджест в web-autohh (запуск из очереди)
};

// Кандидат после локального фильтра: полная вакансия + вердикт фильтра.
interface Candidate {
  full: Vacancy;
  verdict: { ok: boolean; reason?: string };
}

// Прошёл и локальный фильтр, и (если включён) Claude-судью.
interface AcceptedItem extends Candidate {
  score: number | null;
  reason: string | null;
  comment: string | null;
}

// Отклонённые — запись для rejected-дайджеста.
interface RejectedItem {
  id: string;
  title: string;
  employer: string;
  area: string;
  salary: string;
  url: string;
  score: number | null;
  reason: string | null;
}

// Узкий предикат: значение — обычный (не-массивный) объект.
function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

async function collectVacancies(client: HHClient, search: NonNullable<SearchConfig['search']>, cache: CacheDoc): Promise<Vacancy[]> {
  const results: Vacancy[] = [];
  const startPage = search.start_page || 0;
  const maxPages = search.max_pages || 1;
  for (let page = startPage; page < startPage + maxPages; page++) {
    // Страницу 0 всегда забираем свежей — на ней новые вакансии.
    const cached = page === 0 ? null : cache.pages[String(page)];
    if (cached) {
      log.info(`Page ${page}: ${cached.length} vacancies (cached)`);
      results.push(...cached);
      continue;
    }

    const params: SearchParams = {
      text: search.text,
      area: search.area,
      experience: search.experience,
      salary: search.salary,
      only_with_salary: search.only_with_salary,
      currency: search.currency,
      per_page: search.per_page || 50,
      page,
      schedule: search.schedule,
      employment: search.employment,
    };

    const data = await client.searchVacancies(params);
    log.info(`Page ${page}: ${data.items.length} vacancies (total ${data.found})`);
    cache.pages[String(page)] = data.items;
    await collectCache.savePage(cache, page);
    results.push(...data.items);
    if (page + 1 >= (data.pages || 0)) break;
  }
  return results;
}

function fmtSalary(s: Vacancy['salary']) {
  if (!s) return '—';
  const parts = [];
  if (s.from) parts.push(`от ${s.from}`);
  if (s.to) parts.push(`до ${s.to}`);
  return `${parts.join(' ') || '?'} ${s.currency || ''}`.trim();
}

// Общие поля строки дайджеста/отклонённых, которые заполняются из полной вакансии.
function toRow(full: Vacancy): Omit<RejectedItem, 'score' | 'reason'> {
  return {
    id: String(full.id),
    title: full.name,
    employer: full.employer?.name || '—',
    area: full.area?.name || '—',
    salary: fmtSalary(full.salary),
    url: full.alternate_url || `https://hh.ru/vacancy/${full.id}`,
  };
}

async function filterLocally(client: HHClient, items: Vacancy[], cache: CacheDoc, cfg: SearchConfig): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const item of items) {
    let full = cache.fullById[String(item.id)];
    if (!full) {
      if (await history.isSeen(String(item.id))) continue;
      try {
        full = await client.getVacancy(item.id) as Vacancy;
      } catch (err: unknown) {
        log.warn(`Failed to fetch vacancy ${item.id}: ${errMsg(err)}`);
        await history.markSeen(String(item.id));
        continue;
      }
      if (!full) {
        log.warn(`Empty vacancy ${item.id}, skipping`);
        await history.markSeen(String(item.id));
        continue;
      }
      cache.fullById[String(item.id)] = full;
      await collectCache.saveFull(cache, String(item.id));
    }

    const verdict = vacancyMatchesFilter(full, cfg.filter || {});
    await history.markSeen(String(item.id));
    if (!verdict.ok) {
      log.info(`Skip ${item.id} (${full.name}): ${verdict.reason}`);
      continue;
    }
    candidates.push({ full, verdict });
  }
  return candidates;
}

async function judgeWithClaude(resume: Resume, candidates: Candidate[], cache: CacheDoc, minScore: number, adaptResume = false, resumeId?: string) {
  const judgements = new Map<string, Verdict>();
  for (const [id, j] of Object.entries(cache.judgements)) judgements.set(id, j);
  let judgedCount = 0;

  const pending = candidates.filter(c => !judgements.has(String(c.full.id)));
  if (pending.length < candidates.length) {
    log.info(`Judgements from cache: ${candidates.length - pending.length}/${candidates.length}`);
  }

  const batchSize = parseInt(process.env.JUDGE_BATCH_SIZE || '10', 10);
  const batches: Vacancy[][] = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize).map(c => c.full));
  }

  let nextBatchIdx = 0;
  const CONCURRENCY = 10;

  async function runBatch(idx: number, batch: Vacancy[]) {
    log.info(`Judging batch ${idx}: ${batch.length} vacancies`);
    const result = await judgeVacanciesBatch(resume, batch, { minScore, adaptResume });
    if (!result) {
      log.warn(`Batch ${idx} failed, ${batch.length} vacancies skipped (no verdict)`);
      judgedCount += batch.length;
    } else {
      for (const [id, j] of result.entries()) {
        judgements.set(id, j);
        cache.judgements[id] = j;
      }
      await collectCache.saveJudgements(cache, resumeId);
      judgedCount += batch.length;
    }
  }

  async function worker() {
    while (nextBatchIdx < batches.length) {
      const batch = batches[nextBatchIdx];
      const num = nextBatchIdx + 1;
      nextBatchIdx++;
      await runBatch(num, batch);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()));
  return { judgements, judgedCount };
}

function selectAccepted(candidates: Candidate[], judgements: Map<string, Verdict>, useClaude: boolean, maxRun: number) {
  const accepted: AcceptedItem[] = [];
  const rejected: RejectedItem[] = [];
  for (const { full, verdict } of candidates) {
    if (accepted.length >= maxRun) break;

    let score: number | null = null;
    let reason: string | null = null;
    let comment: string | null = null;

    if (useClaude) {
      const judgement = judgements.get(String(full.id));
      if (!judgement) {
        log.warn(`No judgement for ${full.id}, falling back to template`);
      } else {
        score = judgement.score;
        reason = judgement.reason;
        comment = judgement.comment;
        if (!judgement.fit) {
          log.info(`Claude rejected ${full.id} (score=${score}): ${reason}`);
          rejected.push({ ...toRow(full), score, reason });
          continue;
        }
        log.info(`Claude approved ${full.id} (score=${score}): ${comment || reason}`);
      }
    }

    accepted.push({ full, verdict, score, reason, comment });
  }
  return { accepted, rejected };
}

async function generateCoverLetters(resume: Resume | null, accepted: AcceptedItem[], cache: CacheDoc, dryRun: boolean, resumeId?: string): Promise<Map<string, string>> {
  const coverBatchSize = parseInt(process.env.COVER_BATCH_SIZE || '20', 10);
  const coverMap = new Map<string, string>();
  for (const [id, letter] of Object.entries(cache.coverLetters)) coverMap.set(id, letter);

  if (!dryRun && accepted.length) {
    const pending = accepted.filter(a => !coverMap.has(String(a.full.id)));
    if (pending.length < accepted.length) {
      log.info(`Cover letters from cache: ${accepted.length - pending.length}/${accepted.length}`);
    }
    if (pending.length) {
      log.info(`Generating cover letters in batches of ${coverBatchSize} for ${pending.length} vacancies`);
      const generated = await buildCoverLettersBatch(
        resume,
        pending.map(a => ({ vacancy: a.full })),
        coverBatchSize,
        async (partial) => {
          for (const [id, letter] of partial.entries()) {
            coverMap.set(id, letter);
            cache.coverLetters[id] = letter;
            await collectCache.saveCoverLetter(cache, id, resumeId);
          }
        },
      );
      for (const [id, letter] of generated.entries()) coverMap.set(id, letter);
    }
  }

  return coverMap;
}

async function buildResults(accepted: AcceptedItem[], coverMap: Map<string, string>, cache: CacheDoc, cfg: PipelineConfig, resume: Resume | null = null): Promise<DigestEntry[]> {
  const matched: DigestEntry[] = [];
  for (const a of accepted) {
    const { full, score, reason, comment } = a;
    let coverLetter = coverMap.get(String(full.id));
    if (!coverLetter) {
      coverLetter = await buildCoverLetter(cfg.apply?.coverLetterTemplate || '', full, resume);
      if (coverLetter) {
        cache.coverLetters[String(full.id)] = coverLetter;
        await collectCache.saveCoverLetter(cache, String(full.id));
      }
    }

    matched.push({
      ...toRow(full),
      score,
      reason,
      comment,
      coverLetter: coverLetter ?? '',
    });
    await history.markApplied(String(full.id), {
      title: full.name,
      employer: full.employer?.name,
      url: full.alternate_url,
      score,
      digestOnly: true,
    });
    log.info(`Match: ${full.name} @ ${full.employer?.name} -> ${full.alternate_url}`);
  }
  return matched;
}

// useWebDb=true — статус пишется в базу backend (web-autohh), для запусков из очереди.
// false — локальная autohh (ручной auto-hh search --job).
async function updateJobStatus(jobId: string | undefined, status: string, result?: Record<string, unknown>, useWebDb = false): Promise<void> {
  if (!jobId) return;
  try {
    const db = useWebDb ? queueDbInstance() : await connect();
    const set: Document = { status, updatedAt: new Date() };
    if (status === 'running') set.startedAt = new Date();
    if (status === 'completed' || status === 'failed') set.completedAt = new Date();
    if (result) set.result = result;
    await db.collection('search_jobs').updateOne(
      { _id: new ObjectId(jobId) },
      { $set: set },
    );
  } catch (err: unknown) {
    log.warn(`Failed to update job ${jobId}: ${errMsg(err)}`);
  }
}

// Выбор БД для статусов/дайджеста: web (backend) при запуске из очереди, иначе локальная.
function jobDb(useWebDb: boolean) {
  return useWebDb ? queueDbInstance() : dbInstance();
}

// Глубокий merge для вложенных search/filter/apply: override точечно подменяет поля base.
function mergeConfig<T>(base: T, override: unknown): T {
  if (!override) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (isRecord(v) && isRecord(out[k])) out[k] = mergeConfig(out[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out as T;
}

// cfg — SearchConfig из packages/shared (контракт backend↔CLI) плюс локальный блок api.
async function runSearchPipeline(cfg: PipelineConfig, opts: PipelineOpts = {}) {
  const useWebDb = !!opts.useWebDb;
  const client = new HHClient();

  await updateJobStatus(opts.job, 'running', undefined, useWebDb);
  const resume = loadResume(opts.resume);
  const resumeId = resume?.id;
  const minScore = cfg.apply?.minClaudeScore ?? 7;
  const dryRun = opts.dryRun ?? cfg.apply?.dryRun ?? false;
  const hasApiKey = cfg.api?.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const useClaude = Boolean(resume && hasApiKey && opts.claude !== false);
  const maxRun = cfg.apply?.maxPerRun || 50;

  try {
    if (resume) {
      log.info(`Resume loaded: ${resumeId} (${resume.filename}, ${resume.type})`);
      await registerResume(resume).catch(() => {});
    } else {
      log.warn('RESUME_PATH not set — Claude judge disabled, fall back to local filter only');
    }

    log.info('Searching vacancies', cfg.search);
    const cache = await collectCache.load(undefined, resumeId);
    const items = await collectVacancies(client, cfg.search || {}, cache);

    const candidates = await filterLocally(client, items, cache, cfg);
    log.info(`Local filter passed: ${candidates.length}/${items.length}`);

    const adaptResume = cfg.adaptResume !== false;
    const { judgements, judgedCount } = useClaude
      ? await judgeWithClaude(resume as Resume, candidates, cache, minScore, adaptResume, resumeId)
      : { judgements: new Map<string, Verdict>(), judgedCount: 0 };

    const { accepted, rejected } = selectAccepted(candidates, judgements, useClaude, maxRun);

    const coverMap = await generateCoverLetters(resume, accepted, cache, dryRun, resumeId);

    const matched = await buildResults(accepted, coverMap, cache, cfg, resume);

    log.info(`Judged by Claude: ${judgedCount}, accepted: ${matched.length}, rejected: ${rejected.length}`);

    const rejectedFile = await writeRejected(rejected, opts.user, useWebDb ? jobDb(useWebDb) : undefined);
    if (useWebDb) log.info(`Rejected: ${rejected.length} vacancies (web-autohh)`);
    else if (rejectedFile) log.info(`Rejected saved: ${rejectedFile} (${rejected.length} vacancies)`);

    if (matched.length === 0) {
      log.info('No matching vacancies.');
      await updateJobStatus(opts.job, 'completed', { totalVacancies: items.length, matched: 0, rejected: rejected.length }, useWebDb);
      return;
    }

    const file = await writeDigest(matched, opts.user, useWebDb ? jobDb(useWebDb) : undefined);
    if (useWebDb) log.info(`Digest: ${matched.length} vacancies (web-autohh)`);
    else if (file) log.info(`Digest saved: ${file} (${matched.length} vacancies)`);
    console.log('\n=== TOP MATCHES ===');
    for (const e of matched.slice(0, 10)) {
      console.log(`- [${e.score ?? '?'}/10] ${e.title} @ ${e.employer} | ${e.salary}\n  ${e.url}`);
    }

    await updateJobStatus(opts.job, 'completed', { totalVacancies: items.length, matched: matched.length, rejected: rejected.length }, useWebDb);
  } catch (err: unknown) {
    log.error(`Search failed: ${errMsg(err)}`);
    await updateJobStatus(opts.job, 'failed', { error: errMsg(err) }, useWebDb);
    throw err;
  } finally {
    await client.close?.();
  }
}

async function search(opts: SearchCliOpts = {}) {
  if (opts.config) process.env.CONFIG_PATH = opts.config;
  if (opts.reset) {
    await resetData();
  }

  const cfg = loadConfig();
  await runSearchPipeline(cfg, { ...opts, useWebDb: false });
}

// auto-hh search --worker: слушает BullMQ-очередь 'search', куда backend кладёт
// джобы по POST /api/search/jobs. Параметры поиска приходят в payload джобы.
// Статусы/дайджест/отклонённые пишутся в web-autohh (база backend) — фронт видит.
async function runSearchWorker() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  await connect(); // autohh: история/кэш (дедуп CLI)
  await connectQueueDb(); // web-autohh: статусы search_jobs, digest, rejected

  const worker = new Worker(SEARCH_QUEUE, async (job) => {
    const data = (job.data || {}) as SearchJobPayload;
    const { jobId, userId, config } = data;
    log.info(`Search job received: ${jobId} (user ${userId || '—'})`);
    const cfg = mergeConfig(loadConfig(), config);
    await runSearchPipeline(cfg, { job: jobId, user: userId, useWebDb: true });
  }, { connection: { url: REDIS_URL }, concurrency: 1 });

  // Страховка: если пайплайн упал раньше, чем проставил failed сам, — пометим здесь.
  worker.on('failed', (job, err) => {
    const jobId = job?.data?.jobId;
    log.error(`Search job ${jobId || '?'} failed: ${err.message}`);
    if (jobId) updateJobStatus(jobId, 'failed', { error: err.message }, true).catch(() => {});
  });
  worker.on('error', (e) => log.error(`Worker error: ${e.message}`));

  log.info('Search worker started. Waiting for jobs on BullMQ queue "search".');
  log.info(`Redis: ${REDIS_URL}`);
  log.info('Press Ctrl+C to stop.');

  const shutdown = async () => {
    log.info('Stopping search worker...');
    try { await worker.close(); } catch {}
    try { await closeQueueDb(); } catch {}
    try { await closeDb(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Держим процесс живым, пока воркер не закрыт.
  await new Promise<void>((resolve) => {
    worker.on('closed', resolve);
  });
}

async function main(opts: SearchCliOpts = {}) {
  if (opts.worker) {
    await runSearchWorker();
    return;
  }
  await search(opts);
}

export default main;
