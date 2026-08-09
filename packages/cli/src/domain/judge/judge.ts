import log from "../../logger.js";
import { retryOnTransient } from "../../retry.js";
import { loadConfig } from "../../config";
import { getClient, buildResumeBlock } from "../../clients/ai-client";
import { stripHtml, parseJSON } from "../../utils/text-utils.js";
import { errMsg } from "../../utils/errors.js";
import { adaptResumeForVacancy } from "../adapt-resume.js";
import type { Vacancy, Resume, Verdict, JudgeOpts } from "../../types.js";
import { buildSystemText } from "./system-text.js";

const apiConfig = loadConfig().api || {};

// Сырой ответ модели (ещё не нормализован): поля могут отсутствовать
// или приходить в произвольных JSON-типах.
interface RawVerdict {
  vacancyId?: unknown;
  score?: unknown;
  fit?: unknown;
  reason?: unknown;
  comment?: unknown;
  coverLetter?: unknown;
}

// Гарантирует инвариант вердикта: fit=true ⇒ comment непустой, reason=null;
// fit=false ⇒ reason непустой, comment=null.
function normalizeVerdict(v: RawVerdict): Verdict {
  const score = Math.max(1, Math.min(10, Number(v.score) || 1));
  const fit = v.fit === true;
  const reasonRaw = typeof v.reason === 'string' ? v.reason.trim() : '';
  const commentRaw = typeof v.comment === 'string' ? v.comment.trim() : '';

  let reason: string | null = null;
  let comment: string | null = null;
  if (fit) {
    comment = commentRaw || reasonRaw || `Соответствие профилю (score ${score}/10)`;
  } else {
    reason = reasonRaw || commentRaw || `Совпадение слабое (score ${score}/10)`;
  }

  return {
    vacancyId: String(v.vacancyId ?? ''),
    fit,
    score,
    reason,
    comment,
    coverLetter: typeof v.coverLetter === 'string' ? v.coverLetter : '',
  };
}

function formatVacancyText(vacancy: Vacancy) {
  const description = stripHtml(vacancy.description);
  const skills = (vacancy.key_skills || []).map(s => s.name).join(', ');
  const salary = vacancy.salary
    ? `${vacancy.salary.from || '?'}–${vacancy.salary.to || '?'} ${vacancy.salary.currency || ''}`
    : 'не указана';
  return `vacancyId: ${vacancy.id}
Название: ${vacancy.name}
Компания: ${vacancy.employer?.name || '—'}
Регион: ${vacancy.area?.name || '—'}
Опыт: ${vacancy.experience?.name || '—'}
График: ${vacancy.schedule?.name || '—'}
Занятость: ${vacancy.employment?.name || '—'}
Зарплата: ${salary}
Ключевые навыки: ${skills || '—'}

Описание:
${description}`;
}

// async function judgeVacancy(resume: Resume, vacancy: Vacancy, opts: JudgeOpts = {}): Promise<Verdict | null> {
//   const c = getClient(apiConfig);
//   if (!c) return null;
//
//   const model = process.env.CLAUDE_MODEL || 'gpt-4o';
//   const minScore = opts.minScore ?? 7;
//
//   const vacancyBlock = {
//     type: 'text' as const,
//     text: `=== ВАКАНСИЯ ===\n${formatVacancyText(vacancy)}`,
//   };
//
//   const adaptedText = opts.adaptResume ? adaptResumeForVacancy(resume, vacancy) : null;
//   const resumeBlock = buildResumeBlock(resume, adaptedText);
//   const systemText = buildSystemText(minScore);
//   const messages: any = [
//     { role: 'system' as const, content: systemText },
//     {
//       role: 'user' as const,
//       content: [
//         ...(resumeBlock ? [resumeBlock] : []),
//         vacancyBlock,
//       ],
//     },
//   ];
//   try {
//     const resp = await retryOnTransient(() => c.chat.completions.create({
//       model,
//       messages,
//       response_format: { type: 'json_object' },
//     }));
//     const text = (resp as any).choices?.[0]?.message?.content;
//     if (!text) return null;
//     const parsed = parseJSON(text);
//     const verdict = normalizeVerdict(parsed);
//     log.debug(`judge ${vacancy.id}: score=${verdict.score} fit=${verdict.fit} in=${(resp as any).usage?.prompt_tokens} out=${(resp as any).usage?.completion_tokens}`);
//     return verdict;
//   } catch (err: unknown) {
//     if (err instanceof Error) {
//       log.warn(`judge failed for ${vacancy.id}: ${err.message}`);
//     }
//     return null;
//   }
// }

// Батчевая версия: судит пачку вакансий за один запрос.
// Возвращает Map<vacancyId, verdict> (verdict в том же формате, что judgeVacancy).
async function judgeVacanciesBatch(resume: Resume, vacancies: Vacancy[], opts: JudgeOpts = {}): Promise<Map<string, Verdict> | null> {
  const c = getClient(apiConfig);
  if (!c) return null;
  if (!vacancies.length) return new Map();

  const model = process.env.CLAUDE_MODEL || 'gpt-4o';
  const minScore = opts.minScore ?? 7;
  const adapt = opts.adaptResume;

  const systemText = buildSystemText(minScore) +
    `\n\nВ этом запросе подаётся СРАЗУ НЕСКОЛЬКО вакансий. Для каждой верни отдельную запись в массиве verdicts с полем vacancyId, в том же порядке, что во входе.${adapt ? '\n\nДля каждой вакансии передано адаптированное под неё резюме — учитывай только его при оценке.' : ''}`;

  const vacanciesText = vacancies.map((v, i) => {
    let block = '';
    if (adapt) {
      const adapted = adaptResumeForVacancy(resume, v);
      if (adapted) {
        block += `=== АДАПТИРОВАННОЕ РЕЗЮМЕ (вакансия #${i + 1}) ===\n${adapted}\n\n`;
      }
    }
    block += `=== ВАКАНСИЯ #${i + 1} ===\n${formatVacancyText(v)}`;
    return block;
  }).join('\n\n');

  const resumeBlock = !adapt ? buildResumeBlock(resume) : null;

  const messages  = [
    { role: 'system' as const, content: systemText },
    {
      role: 'user' as const,
      content: [
        ...(resumeBlock ? [resumeBlock] : []),
        { type: 'text' as const, text: vacanciesText },
      ],
    },
  ];

  try {
    const resp = await retryOnTransient(() => c.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
    }));
    const text = resp.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = parseJSON(text) as { verdicts?: RawVerdict[] };

    log.debug(`judge batch ${vacancies.length}: in=${resp.usage?.prompt_tokens || 0} out=${resp.usage?.completion_tokens || 0}`);

    const map = new Map<string, Verdict>();
    for (const v of parsed.verdicts || []) {
      const verdict = normalizeVerdict(v);
      map.set(verdict.vacancyId, verdict);
    }
    return map;
  } catch (err: unknown) {
    if (err instanceof Error) {
      log.warn(`judge batch failed (${vacancies.length} items): ${err.message}`);
    }
    return null;
  }
}

export { judgeVacanciesBatch };
