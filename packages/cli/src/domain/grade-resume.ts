import { loadConfig } from "../config.js";
import { getClient } from "../clients/ai-client";
import { loadResume } from "../resume.js";
import { retryOnTransient } from "../retry.js";
import { safeJsonParse } from "../utils/text-utils.js";
import { errMsg } from "../utils/errors.js";
import log from "../logger.js";
import type { Resume } from "../types.js";

const apiConfig = loadConfig().api || {};

function buildSystemText(): string {
  return `Ты профессиональный HR-эксперт и карьерный консультант. Проведи подробную оценку резюме соискателя.

Сначала напиши общую оценку — 1-2 абзаца (на русском), резюмирующие впечатление, уровень кандидата, ключевые выводы.

Затем сформируй списки:
- **strengths** — сильные стороны (3-5 пунктов)
- **weaknesses** — слабые стороны (3-4 пункта)
- **missing** — что отсутствует в резюме (2-3 пункта)
- **recommendations** — конкретные рекомендации (3-4 пункта)

Оцени 5 взвешенных категорий (сумма max = 100):
1. **Первое впечатление** — заголовок, контактные данные, первые строки (max 25)
2. **Ясность позиционирования** — насколько понятна роль и уровень (max 25)
3. **Красные флаги** — перерывы, частая смена работы, несоответствия (max 20)
4. **Контекст и масштаб** — размеры команд, масштабы проектов, бизнес-импакт (max 20)
5. **Готовность к шортлисту** — общее впечатление, готовность рекомендовать (max 10)

Затем сделай детальный разбор по 9 категориям. Для каждой:
- **status**: "good" или "attention"
- **description**: 1-2 предложения с анализом
- **quotes**: цитаты из резюме (1-3 строки). ВАЖНО: экранируй кавычки внутри цитат (заменяй " на \\")
- **recommendations** (опционально): советы по улучшению

Категории детального разбора:
1. Грамотность — орфография, пунктуация, читаемость
2. Красные флаги — перерывы, частая смена работы, несоответствия
3. Позиционирование — соответствие целевой роли
4. Первые 10 секунд — заголовок, компании, технологии
5. Социальные доказательства — известные компании, проекты
6. Навыки — релевантность, полнота, современность стека
7. Секция "Обо мне" — самопрезентация, конкретика
8. Карьерный путь — логичность роста, последовательность
9. Качество описания опыта — метрики, достижения вместо обязанностей

ВАЖНО: все строки в JSON должны быть валидными. Экранируй кавычки внутри строк через \\". Не используй неэкранированные кавычки внутри значений.

Формат ответа — строго JSON:
{
  "overallScore": 82,
  "overallAssessment": "текст",
  "strengths": ["сильная сторона"],
  "weaknesses": ["слабая сторона"],
  "missing": ["чего не хватает"],
  "recommendations": ["рекомендация"],
  "categoryScores": {
    "firstImpression": { "score": 20, "max": 25 },
    "positioning": { "score": 22, "max": 25 },
    "redFlags": { "score": 20, "max": 20 },
    "contextAndScale": { "score": 15, "max": 20 },
    "shortlistReadiness": { "score": 5, "max": 10 }
  },
  "detailedAnalysis": [
    {
      "category": "Грамотность",
      "status": "good",
      "description": "текст",
      "quotes": ["цитата из резюме"],
      "recommendations": ["совет"]
    }
  ]
}`;
}

export interface GradeCategoryScore {
  score?: number;
  max?: number;
}

export interface GradeDetailedItem {
  category?: string;
  status?: string;
  description?: string;
  quotes?: string[];
  recommendations?: string[];
}

export interface GradeResult {
  overallScore?: number;
  overallAssessment?: string;
  strengths?: string[];
  weaknesses?: string[];
  missing?: string[];
  recommendations?: string[];
  categoryScores?: {
    firstImpression?: GradeCategoryScore;
    positioning?: GradeCategoryScore;
    redFlags?: GradeCategoryScore;
    contextAndScale?: GradeCategoryScore;
    shortlistReadiness?: GradeCategoryScore;
  };
  detailedAnalysis?: GradeDetailedItem[];
}

async function gradeResume(resume?: Resume, resumeName?: string): Promise<GradeResult | null> {
  const client = getClient(apiConfig);
  if (!client) {
    log.warn("gradeResume: no API client (check API key)");
    return null;
  }

  const model = process.env.CLAUDE_MODEL || "gpt-4o";

  const r = resume || loadResume(resumeName);
  if (!r) {
    log.warn("gradeResume: resume not found (set RESUME_PATH)");
    return null;
  }

  const resumeText = r.type === "pdf" ? `[PDF] ${r.filename}` : r.text;

  const messages = [
    { role: "system" as const, content: buildSystemText() },
    {
      role: "user" as const,
      content: `Оцени следующее резюме:\n\n${resumeText}`,
    },
  ];

  try {
    const resp = await retryOnTransient(() =>
      client.chat.completions.create({
        model,
        max_tokens: 50000,
        messages,
        response_format: { type: "json_object" },
      })
    );

    const text = resp.choices?.[0]?.message?.content;
    if (!text) {
      log.warn("gradeResume: empty response");
      return null;
    }

    const parsed = safeJsonParse(text) as GradeResult;
    log.debug(
      `gradeResume: score=${parsed.overallScore} in=${resp.usage?.prompt_tokens} out=${resp.usage?.completion_tokens}`
    );
    return parsed;
  } catch (err: unknown) {
    log.warn(`gradeResume failed: ${errMsg(err)}`);
    return null;
  }
}

export { gradeResume };