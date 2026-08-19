// Команда apply: отклик через Playwright.
import fs from "fs";
import path from "path";
import {  chromium  } from "playwright";
import type { Page, BrowserContext } from "playwright";
import { Worker } from "bullmq";
import { ObjectId } from "mongodb";
import { APPLY_QUEUE, ApplyJobData } from "@auto-hh/shared";
import log from "../logger";
import { errMsg } from "../utils/errors.js";
import history from "../store/history-store";
import  {getDigestsByDate, getAllDigests} from "../store/digest-store";
import {  connect, dbInstance, close as closeDb  } from "../clients/db";
import { connectQueueDb, queueDbInstance, closeQueueDb } from "../clients/queue-db";

const PROFILE = path.resolve(process.env.PW_USER_DATA_DIR || './data/browser-profile');
const HEADLESS = String(process.env.PW_HEADLESS || 'false') === 'true';
const MIN_DELAY = parseInt(process.env.PW_MIN_DELAY_MS || '500', 10);
const MAX_DELAY = parseInt(process.env.PW_MAX_DELAY_MS || '2000', 10);
const TEST_MODE = (process.env.PW_TEST_MODE || 'manual').toLowerCase();
const TEST_TIMEOUT = parseInt(process.env.PW_TEST_TIMEOUT_MS || '0', 10);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Минимум полей вакансии для отклика (digest-запись или джоба из apply_queue).
// title/employer могут отсутствовать — в applyToVacancy везде есть fallback.
interface ApplyEntry {
  id: string;
  url: string;
  title?: string;
  employer?: string;
  coverLetter?: string | null;
  // Резюме, которым откликаемся (resumeId из конфига юзера; пробрасывается
  // из ApplyJobData). Пока информативно — выбор резюме в форме hh.ru
  // автоматизируется отдельным шагом.
  resumeId?: string | null;
}

// Запись в apply_queue (документы создаёт backend; CLI читает их в батч-режиме --queue).
interface ApplyQueueDoc {
  _id: ObjectId;
  vacancyId?: string;
  id?: string;
  url?: string;
  title?: string;
  employer?: string;
  status?: string;
  userId?: string;
  addedAt?: Date;
}

// Единая запись для цикла отклика: и из дайджеста (DigestEntry), и из очереди.
interface QueueEntry {
  id: string;
  vacancyId?: string;
  url: string;
  title?: string;
  employer?: string;
  coverLetter?: string;
  _id?: ObjectId;
}

// Опции команды `auto-hh apply` (commander). Совпадают с флагами в index.ts.
interface ApplyCliOpts {
  login?: boolean;
  worker?: boolean;
  queue?: boolean;
  user?: string;
  limit?: number;
  type?: string;
}

function ensureProfile() {
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
}

async function loadDigest(type: string) {
  if (type === 'all') {
    log.info('Loading all digests');
    return getAllDigests('digest');
  }
  const date = new Date().toISOString().slice(0, 10);
  return getDigestsByDate('digest', date);
}

async function applyToVacancy(page: Page, entry: ApplyEntry) {
  log.info(`Applying to ${entry.id} (${entry.employer || '?'}: ${entry.title})`);
  if (entry.resumeId) log.info(`Resume: ${entry.resumeId}`);
  const minDelay = parseInt(process.env.PW_MIN_DELAY_MS || '500', 10);
  const maxDelay = parseInt(process.env.PW_MAX_DELAY_MS || '2000', 10);
  await page.goto(entry.url, { waitUntil: 'domcontentloaded' });
  await sleep(rand(minDelay, maxDelay));

  // Проверяем, не откликались ли уже (по странице, а не по локальной истории).
  const alreadyResponded = await checkAlreadyResponded(page);
  if (alreadyResponded) {
    log.info(`Already applied (detected on page): ${entry.id}`);
    return { ok: true, note: 'already applied (page)' };
  }

  // Пробуем разные селекторы кнопки отклика.
  const selectors = [
    'a[data-qa="vacancy-response-link-top"]',
    'a[data-qa="vacancy-response-link"]',
    'button[data-qa="vacancy-response-link-top"]',
    'a[href^="/applicant/vacancy_response"]',
  ];
  let btnClicked = false;
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click().catch(() => {});
      btnClicked = true;
      break;
    }
  }
  if (!btnClicked) {
    log.warn(`No response button found for ${entry.id}`);
    return { ok: false, reason: 'no response button' };
  }

  await sleep(rand(1500, 3000));

  // Проверяем тестовое задание.
  const postState = await detectPostState(page);
  if (postState === 'test') {
    log.warn(`Test required for ${entry.id}`);
    if (TEST_MODE === 'skip') return { ok: false, reason: 'test required' };
    if (TEST_MODE === 'manual') {
      try {
        await waitForEnter(`Тест для вакансии "${entry.title}" (${entry.url}). Пройдите тест в браузере.`);
      } catch (e: unknown) {
        const msg = errMsg(e);
        log.warn(`Manual test timeout for ${entry.id}: ${msg}`);
        return { ok: false, reason: msg };
      }
    }
  }
  if (postState === 'applied') {
    log.info(`Already applied (no popup): ${entry.id}`);
    return { ok: true, note: 'already applied' };
  }

  // Новая форма отклика (полностраничная, без попапа): раскрываем поле письма
  const letterToggle = await page.$('[data-qa="vacancy-response-letter-toggle"]');
  if (letterToggle) {
    await letterToggle.click();
    await sleep(rand(500, 1000));
  }

  // Заполняем сопроводительное.
  const textareaSel = 'textarea[data-qa="vacancy-response-popup-form-letter-input"], textarea[name="text"], textarea[data-qa*="letter"]';
  const textarea = await page.waitForSelector(textareaSel, { timeout: 8000 }).catch(() => null);
  if (textarea && entry.coverLetter) {
    await textarea.fill(entry.coverLetter);
    log.info('Cover letter filled');
  } else if (entry.coverLetter) {
    const dumpPath = path.join(__dirname, '..', '..', 'data', `apply-dom-${entry.id}.html`);
    try {
      const html = await page.content();
      fs.writeFileSync(dumpPath, html);
      log.warn(`Letter textarea NOT found. Dumped DOM to ${dumpPath}`);
    } catch (_) {}
    return { ok: false, reason: 'letter textarea not found — refusing to submit without cover letter' };
  }

  // Ручное подтверждение: пользователь сам нажимает «Откликнуться» в браузере.
  log.info(`\n>>> Вакансия "${entry.title || entry.id}" @ ${entry.employer || '?'}`);
  log.info(`>>> Сопроводительное заполнено. Проверьте и нажмите «Откликнуться» в браузере.`);
  log.info(`>>> Ожидание...`);

  const manualTimeout = parseInt(process.env.PW_MANUAL_TIMEOUT_MS || '300000', 10);
  const hadTextarea = !!textarea;
  let submitted = false;

  try {
    await page.waitForFunction(
      (args: { textareaSel: string; hadTextarea: boolean }) => {
        const url = window.location.href;
        // Полностраничная форма: редирект на negotiations/test
        if (url.includes('/applicant/negotiations/') || url.includes('/applicant/vacancy_response/test')) {
          return true;
        }
        // Попап-форма: окно с полем ввода закрылось
        if (args.hadTextarea && !document.querySelector(args.textareaSel)) {
          return true;
        }
        // Запасной вариант: кнопка отклика исчезла или стала ссылкой на negotiations
        const btn = document.querySelector('a[data-qa="vacancy-response-link-top"], a[data-qa="vacancy-response-link"]');
        if (btn && btn.getAttribute('href')?.includes('/applicant/negotiations/')) {
          return true;
        }
        return false;
      },
      { textareaSel, hadTextarea },
      { timeout: manualTimeout, polling: 500 },
    );
    submitted = true;
  } catch (e) {
    log.warn(`Manual submit wait timeout for ${entry.id}`);
  }

  if (!submitted) {
    return { ok: false, reason: 'manual submit timeout' };
  }

  const afterSubmitState = await detectPostState(page);
  if (afterSubmitState === 'test') {
    log.warn(`Test required for ${entry.id}`);
    if (TEST_MODE === 'skip') return { ok: false, reason: 'test required' };
    if (TEST_MODE === 'manual') {
      try {
        await waitForEnter(`Тест для вакансии "${entry.title || entry.id}" (${entry.url}). Пройдите тест в браузере.`);
      } catch (e: unknown) {
        const msg = errMsg(e);
        log.warn(`Manual test timeout for ${entry.id}: ${msg}`);
        return { ok: false, reason: msg };
      }
    }
  }

  log.info(`Submitted: ${entry.id} @ ${entry.employer || '?'}`);
  return { ok: true };
}

async function detectPostState(page: Page) {
  const url = page.url();
  if (/\/applicant\/vacancy_response\/test/.test(url)) return 'test';
  if (/\/applicant\/negotiations/.test(url)) return 'applied';
  return 'unknown';
}

// Проверяет, не откликались ли уже на эту вакансию, по содержимому страницы.
async function checkAlreadyResponded(page: Page) {
  // 1. Кнопка отклика — ссылка на negotiations (уже откликнулись)
  const respondedLink = await page.$('a[data-qa="vacancy-response-link-top"][href*="negotiation"], a[data-qa="vacancy-response-link"][href*="negotiation"]');
  if (respondedLink) return true;

  // 2. Текст "Вы откликнулись" на странице
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
  if (/вы\s+откликнулись/i.test(bodyText)) return true;

  // 3. URL уже на negotiations (редирект)
  if (/\/applicant\/negotiations/.test(page.url())) return true;

  return false;
}

function waitForEnter(message: string) {
  return new Promise<void>((resolve, reject) => {
    process.stdout.write(`\n>>> ${message}\n>>> Нажмите ENTER в этой консоли, когда закончите...\n`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onData = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      if (timer) clearTimeout(timer);
      resolve();
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
    if (TEST_TIMEOUT > 0) {
      timer = setTimeout(() => {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        reject(new Error('manual test timeout'));
      }, TEST_TIMEOUT);
    }
  });
}

async function loginFlow() {
  ensureProfile();
  log.info(`Launching headful browser, profile: ${PROFILE}`);
  log.info('Залогиньтесь на hh.ru вручную, потом просто закройте браузер.');
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://hh.ru/account/login', { waitUntil: 'domcontentloaded' });
  await new Promise(() => {}); // бесконечное ожидание — браузер жив, пока не закроют.
}

async function loadQueue(userId?: string): Promise<QueueEntry[]> {
  await connect();
  const filter: { status: string; userId?: string } = { status: 'queued' };
  if (userId) filter.userId = userId;
  const docs = await dbInstance().collection<ApplyQueueDoc>('apply_queue').find(filter).sort({ addedAt: 1 }).toArray();
  // Единый формат: id — из vacancyId (или id), url обязателен для applyToVacancy.
  return docs.map(d => ({ ...d, id: String(d.vacancyId || d.id || ''), url: d.url || '' }));
}

async function updateQueueItem(id: string, status: string, errorMessage?: string): Promise<void> {
  await dbInstance().collection('apply_queue').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, errorMessage: errorMessage || null, processedAt: new Date(), updatedAt: new Date() } },
  );
}

async function apply(opts: ApplyCliOpts = {}) {
  if (opts.login) {
    await loginFlow();
    return;
  }
  if (opts.worker) {
    await runApplyWorker(opts);
    return;
  }

  ensureProfile();

  let entries: QueueEntry[];
  if (opts.queue) {
    entries = await loadQueue(opts.user);
    log.info(`${entries.length} items in apply queue`);
  } else {
    const type = opts.type || 'latest';
    entries = await loadDigest(type);
  }

  if (opts.limit && Number.isFinite(opts.limit) && opts.limit > 0) {
    entries.splice(opts.limit);
    log.info(`Limit applied: ${opts.limit} vacancies`);
  }
  log.info(`${entries.length} vacancies in digest`);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 800 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Проверка авторизации.
  await page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded' });
  if (/\/account\/login/.test(page.url())) {
    log.error('Not logged in. Run `auto-hh apply --login` first.');
    await ctx.close();
    process.exit(1);
  }

  let ok = 0, fail = 0;
  for (const entry of entries) {
    // Determine the vacancy ID — queue items use 'vacancyId', digest entries use 'id'
    const vid = entry.vacancyId || entry.id;
    const queueId = opts.queue && entry._id ? entry._id.toHexString() : null;

    const state = await history.load(opts.user);
    const rec = state.applied[vid];
    if (rec && !rec.digestOnly) {
      log.info(`Skip ${vid}: already applied`);
      if (opts.queue && queueId) await updateQueueItem(queueId, 'skipped', 'already applied');
      continue;
    }

    // Mark queue item as processing
    if (opts.queue && queueId) await updateQueueItem(queueId, 'processing');

    try {
      // Ensure entry has 'id' for applyToVacancy
      const applyEntry = { ...entry, id: vid };
      const res = await applyToVacancy(page, applyEntry);
      if (res.ok) {
        await history.markApplied(vid, { via: 'playwright', url: entry.url }, opts.user);
        if (opts.queue && queueId) await updateQueueItem(queueId, 'success');
        ok++;
      } else {
        if (opts.queue && queueId) await updateQueueItem(queueId, 'failed', res.reason);
        fail++;
      }
    } catch (err: unknown) {
      log.warn(`Apply failed for ${entry.id}: ${errMsg(err)}`);
      fail++;
    }
    await sleep(rand(MIN_DELAY, MAX_DELAY));
  }

  log.info(`Done. ok=${ok}, fail=${fail}`);
  await ctx.close();
}

// Тип джобы ApplyJobData и имя очереди APPLY_QUEUE — в packages/shared,
// единый источник правды для backend и CLI.

// Воркер BullMQ-очереди 'apply' (имя очереди совпадает с backend).
// Backend кладёт джобы (фронт → /api/apply-queue), воркер слушает ту же очередь
// и выполняет отклик через Playwright. Статусы пишутся в базу backend'а
// (web-autohh, MONGODB_WEB_URI), а не в autohh.
async function runApplyWorker(opts: ApplyCliOpts = {}) {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  await connectQueueDb(); // web-autohh — статусы apply_queue
  await connect(); // autohh — история (дедуп)

  let ctx: BrowserContext | null = null;
  let page: Page | null = null;
  let loginChecked = false;

  const ensureBrowser = async (): Promise<Page> => {
    if (ctx && page) return page;
    ensureProfile();
    ctx = await chromium.launchPersistentContext(PROFILE, {
      headless: HEADLESS,
      viewport: { width: 1280, height: 800 },
    });
    page = ctx.pages()[0] || await ctx.newPage();
    return page;
  };

  const ensureLoggedIn = async (): Promise<boolean> => {
    if (loginChecked) return true;
    if (!page) return false;
    await page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded' });
    loginChecked = true;
    if (/\/account\/login/.test(page.url())) {
      log.error('Not logged in on hh.ru. Run `auto-hh apply --login` first, then restart the worker.');
      return false;
    }
    return true;
  };

  const updateQueueStatus = async (id: string, status: string, errorMessage?: string) => {
    await queueDbInstance().collection('apply_queue').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, errorMessage: errorMessage || null, processedAt: new Date(), updatedAt: new Date() } },
    );
  };

  const worker = new Worker(APPLY_QUEUE, async (job) => {
    const data = job.data as ApplyJobData;
    const queueId = data.queueId;
    const userId = data.userId;
    log.info(`Received job: ${data.vacancyId} (${data.title || data.employer || '?'}) resume=${data.resumeId || '—'}`);

    // Дедуп по локальной истории (как в батч-режиме).
    const state = await history.load(userId);
    const rec = state.applied[data.vacancyId];
    if (rec && !rec.digestOnly) {
      log.info(`Skip ${data.vacancyId}: already applied`);
      await updateQueueStatus(queueId, 'skipped', 'already applied');
      return { ok: true, note: 'already applied' };
    }

    const pw = await ensureBrowser();
    if (!(await ensureLoggedIn())) {
      await updateQueueStatus(queueId, 'failed', 'not logged in');
      return { ok: false, reason: 'not logged in' };
    }

    await updateQueueStatus(queueId, 'processing');
    const entry: ApplyEntry = {
      id: data.vacancyId,
      url: data.url,
      title: data.title || data.vacancyId,
      employer: data.employer || '?',
      coverLetter: data.coverLetter || null,
      resumeId: data.resumeId || null,
    };

    try {
      const res = await applyToVacancy(pw, entry);
      if (res.ok) {
        await history.markApplied(data.vacancyId, { via: 'bullmq-worker', url: data.url }, userId);
        await updateQueueStatus(queueId, 'success');
        return { ok: true };
      }
      await updateQueueStatus(queueId, 'failed', res.reason || 'apply failed');
      return { ok: false, reason: res.reason || 'apply failed' };
    } catch (err: unknown) {
      const msg = errMsg(err);
      log.warn(`Apply failed for ${data.vacancyId}: ${msg}`);
      await updateQueueStatus(queueId, 'failed', msg);
      return { ok: false, reason: msg };
    }
  }, { connection: { url: REDIS_URL }, concurrency: 1 });

  worker.on('completed', (job) => {
    log.info(`Job done: ${job.data?.vacancyId || '?'}`);
  });
  worker.on('failed', (job, err) => {
    const data = (job?.data || {}) as Partial<ApplyJobData>;
    log.error(`Job ${data.vacancyId || '?'} failed: ${err.message}`);
    if (data.queueId) {
      updateQueueStatus(data.queueId, 'failed', err.message).catch(() => {});
    }
  });
  worker.on('error', (e) => log.error(`Worker error: ${e.message}`));

  log.info('Apply worker started. Waiting for jobs on BullMQ queue "apply".');
  log.info(`Redis: ${REDIS_URL}`);
  log.info('Press Ctrl+C to stop.');

  const shutdown = async () => {
    log.info('Stopping worker...');
    try { await worker.close(); } catch {}
    try { if (ctx) await ctx.close(); } catch {}
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

export default apply;
