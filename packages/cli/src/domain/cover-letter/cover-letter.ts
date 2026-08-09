import log from "../../logger.js";
import { retryOnTransient } from "../../retry.js";
import { loadConfig } from "../../config.js";
import { getClient, buildResumeBlock } from "../../clients/ai-client";
import { stripHtml, parseJSON } from "../../utils/text-utils.js";
import { errMsg } from "../../utils/errors.js";
import { adaptResumeForVacancy } from "../adapt-resume.js";
import { buildBatchSystemText } from "./system-text.js";
import type { Vacancy, Resume } from "../../types.js";

const apiConfig = loadConfig().api || {};

function buildFromTemplate(template: string, vacancy: Vacancy) {
  const ctx: Record<string, string> = {
    title: vacancy.name || '',
    employer: vacancy.employer?.name || '',
    area: vacancy.area?.name || '',
  };
  return template.replace(/\{(\w+)\}/g, (_: string, k: string) => ctx[k] ?? '');
}

async function buildWithClaude(vacancy: Vacancy, resume: Resume | null = null, adaptResume = false) {
  const client = getClient(apiConfig);
  if (!client) return null;

  const profile = process.env.APPLICANT_PROFILE || 'опытный разработчик';
  const model = process.env.CLAUDE_MODEL || 'gpt-4o';
  const description = stripHtml(vacancy.description).slice(0, 1000);
  const skills = (vacancy.key_skills || []).map(s => s.name).join(', ');
  const adaptedResume = adaptResume && resume ? adaptResumeForVacancy(resume, vacancy) : null;
  const userMsg = `${adaptedResume ? `=== МОЁ РЕЗЮМЕ (релевантное) ===\n${adaptedResume}\n\n` : ''}Вакансия: ${vacancy.name}
Компания: ${vacancy.employer?.name || '—'}
Регион: ${vacancy.area?.name || '—'}
Ключевые навыки: ${skills || '—'}

Описание:
${description}

Напиши короткое сопроводительное письмо от моего имени в официально-деловом стиле. 3–5 предложений.

Образец:
"""
Здравствуйте! Заинтересовала вакансия в вашей компании — профиль полностью совпадает с моим опытом. Последние несколько лет работаю с React и NestJS, уверенно владею SQL/ORM, есть опыт с Next.js и SSR. Буду рад обсудить детали на созвоне.
Telegram: @pperelkin, e-mail: pavel.perepelkin@list.ru
"""

Правила:
- Официально-деловой, нейтрально-вежливый тон. Полные предложения, грамотный русский.
- Никакой разговорности, сленга, сокращений ("прям", "трогал", "подшаманивал" и т.п.).
- Избегай канцеляритных штампов ("рассмотрите мою кандидатуру", "готов внести вклад в развитие"): пиши по делу, но корректно.
- Начни с "Здравствуйте!".
- 1–2 конкретных совпадения из описания вакансии.
- Без markdown, без "С уважением", без имени в подписи.
- Заверши строкой "Telegram: @pperelkin, e-mail: pavel.perepelkin@list.ru".
- Не упоминай зарплату, вилку, ожидания по доходу — ни конкретных цифр, ни общих формулировок ("по рынку", "обсуждаемо" и т.п.).
- Не пиши "Заинтересовала вакансия <название компании>", а пиши "заинтересовала ваша вакансия" или "вакансия в вашей компании".
- Не используй длинные тире.
- Начинай основную часть с указания, что стек и задачи полностью подходят под твой профиль (например: "стек и задачи полностью совпадают с моим опытом", "профиль вакансии полностью соответствует моему стеку").`;

  try {
    const resp = await retryOnTransient(() => client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system' as const,
          content: `Ты помогаешь соискателю писать сопроводительные письма для откликов на hh.ru. Профиль соискателя: ${profile}\n\nПиши лаконично, по-человечески, без канцелярита. Цель — убедить рекрутера открыть резюме.`,
        },
        { role: 'user' as const, content: userMsg },
      ],
    }));
    const text = resp.choices?.[0]?.message?.content?.trim();
    if (text) {
      log.debug(`Claude usage: in=${resp.usage?.prompt_tokens} out=${resp.usage?.completion_tokens}`);
    }
    return text || null;
  } catch (err: unknown) {
    log.warn(`Claude generation failed: ${errMsg(err)}`);
    return null;
  }
}

async function buildCoverLetter(template: string, vacancy: Vacancy, resume: Resume | null = null) {
  const cfg = loadConfig();
  const adaptResume = cfg.adaptResume !== false;
  const claudeText = await buildWithClaude(vacancy, resume, adaptResume);
  if (claudeText) return claudeText;
  return buildFromTemplate(template, vacancy);
}

function formatVacancyShort(vacancy: Vacancy) {
  const description = stripHtml(vacancy.description).slice(0, 1000);
  const skills = (vacancy.key_skills || []).map(s => s.name).join(', ');
  return `vacancyId: ${vacancy.id}
Название: ${vacancy.name}
Компания: ${vacancy.employer?.name || '—'}
Регион: ${vacancy.area?.name || '—'}
Ключевые навыки: ${skills || '—'}
Описание:
${description}`;
}

// Генерирует сопроводительные пачками по batchSize вакансий за один запрос.
// items: [{ vacancy }]. Возвращает Map<vacancyId, text>.
// onBatch(partialResult) — вызывается после каждой пачки с накопленным результатом.
async function buildCoverLettersBatch(
  resume: Resume | null,
  items: { vacancy: Vacancy }[],
  batchSize = 20,
  onBatch: ((result: Map<string, string>) => void | Promise<void>) | null = null,
) {
  const client = getClient(apiConfig);
  const result = new Map<string, string>();
  if (!client || !items.length) return result;
  const c = client; // не-null после guard выше (TS не сужает client в замыканиях)

  const model = process.env.CLAUDE_MODEL || 'gpt-4o';
  const profile = process.env.APPLICANT_PROFILE || 'опытный разработчик';
  const cfg = loadConfig();
  const adapt = cfg.adaptResume !== false;
  const resumeBlock = !adapt ? buildResumeBlock(resume) : null;

  const systemText = buildBatchSystemText(profile) +
    (adapt ? '\n\nДля каждой вакансии передано адаптированное под неё резюме — учитывай его при составлении письма, указывая релевантный опыт.' : '');

  const batchTexts: { idx: number; batch: { vacancy: Vacancy }[]; text: string }[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    batchTexts.push({
      idx: batchTexts.length + 1,
      batch,
      text: batch.map((it, idx) => {
        let block = '';
        if (adapt) {
          const adapted = adaptResumeForVacancy(resume, it.vacancy);
          if (adapted) {
            block += `=== РЕЗЮМЕ (релевантное для вакансии #${idx + 1}) ===\n${adapted}\n\n`;
          }
        }
        block += `=== ВАКАНСИЯ #${idx + 1} ===\n${formatVacancyShort(it.vacancy)}`;
        return block;
      }).join('\n\n'),
    });
  }

  let nextBatchIdx = 0;
  const CONCURRENCY = 10;

  async function runBatch(ii: number) {
    const { idx, batch, text } = batchTexts[ii];
    const messages = [
      { role: 'system' as const, content: systemText },
      {
        role: 'user' as const,
        content: [
          ...(resumeBlock ? [resumeBlock] : []),
          { type: 'text' as const, text },
        ],
      },
    ];
    try {
      const resp = await retryOnTransient(() => c.chat.completions.create({
        model,
        max_completion_tokens: 1000000,
        messages,
      }));

      const content = resp.choices?.[0]?.message?.content;
      if (!content) {
        log.warn(`cover batch ${idx}: empty response`);
        return;
      }
      const parsed = parseJSON(content) as { letters?: Array<{ vacancyId?: unknown; coverLetter?: unknown }> };
      for (const l of parsed.letters || []) {
        if (l.vacancyId && l.coverLetter) result.set(String(l.vacancyId), String(l.coverLetter));
      }
      log.debug(`cover batch ${idx}: ${batch.length} letters, in=${resp.usage?.prompt_tokens || 0} out=${resp.usage?.completion_tokens || 0}`);
      if (onBatch) {
        try { await onBatch(result); } catch (e: unknown) { log.warn(`cover onBatch callback failed: ${errMsg(e)}`); }
      }
    } catch (err: unknown) {
      log.warn(`cover batch ${idx} failed (${batch.length} items): ${errMsg(err)}`);
    }
  }

  async function worker() {
    while (nextBatchIdx < batchTexts.length) {
      const ii = nextBatchIdx;
      nextBatchIdx++;
      await runBatch(ii);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batchTexts.length) }, () => worker()));

  return result;
}

export { buildCoverLetter, buildCoverLettersBatch };
