# 🤖 auto-hh

Автоматический поиск, AI-оценка и отклик на вакансии hh.ru.

> ⚠️ **Disclaimer:** Соискательский API hh.ru отключён с 15.12.2025. Отклики выполняются через **Playwright** (браузерная автоматизация), что нарушает пользовательское соглашение hh.ru и может привести к блокировке аккаунта. Используйте на свой страх и риск, желательно с тестового аккаунта и без агрессивных интервалов.

---

## 📋 Возможности

- 🔍 **Поиск** через публичное API hh.ru с гибкими фильтрами (анонимно, авторизация не нужна)
- 🎯 **Локальный пре-фильтр** — навыки, исключённые слова/компании, зарплата
- 🧠 **AI-судья** (Claude / OpenAI) — читает ваше резюме и оценивает каждую вакансию: score 1–10, вердикт fit/no-fit, объяснение, red flags
- 📝 **Сопроводительные письма** — AI генерирует персонализированное письмо под каждую вакансию на основе резюме
- ✂️ **Адаптация резюме** — AI-судья получает сокращённую версию резюме, релевантную конкретной вакансии (ключевые термины, навыки)
- 🏆 **Оценка резюме** — AI-рекрутер анализирует ваше резюме: сильные/слабые стороны, детальный разбор по 9 категориям, рекомендации
- 📊 **Дайджест** — результат в JSON/Markdown с вердиктом, скором и письмом
- 🖥️ **Автоотклик** через сохранённую сессию браузера (Playwright)
- 📅 **Планировщик** — cron-расписание для автоматического поиска
- 💾 **Кэширование** — страницы поиска, вердикты и письма кэшируются в MongoDB; после обрыва не нужно ходить в hh и тратить AI-токены заново
- 📜 **История** — какие вакансии уже видели / куда откликались
- 📂 **Несколько резюме** — директория `resumes/` с выбором через `--resume <name>`

---

## 🚀 Быстрый старт

```bash
# 1. Установка
npm install
npx playwright install chromium

# 2. Настройка
cp .env.example .env
# Отредактируйте .env — добавьте API-ключ и настройте резюме

# 3. Положите резюме в ./resumes/ (или укажите RESUME_PATH для одного файла)

# 4. Залогиньтесь в hh.ru (сохранит сессию браузера)
npm run login

# 5. Поиск и оценка
npm start

# 6. Отклик
npm run apply
```

---

## 🖥️ Команды CLI

```
auto-hh <command> [options]
```

### `search` — поиск, AI-оценка, генерация писем → дайджест

```bash
npm start                           # базовый запуск
auto-hh search --resume frontend    # выбрать резюме из RESUME_DIR
auto-hh search --reset              # сбросить историю и кэш перед запуском
auto-hh search --no-claude          # только локальный фильтр, без AI
auto-hh search --dry-run            # без генерации писем
auto-hh search --config ./prod.json # альтернативный конфиг
```

| Флаг | Описание |
|------|----------|
| `-c, --config <path>` | Путь к config.json |
| `-r, --resume <name>` | Имя резюме из `RESUME_DIR` (без расширения) |
| `--reset` | Сбросить историю и кэш перед запуском |
| `--no-claude` | Без AI, только локальный фильтр |
| `-d, --dry-run` | Только поиск, без генерации писем |

### `apply` — автоотклик через Playwright

```bash
npm run apply                       # отклик на сегодняшний дайджест
auto-hh apply --limit 5             # только первые 5 вакансий
auto-hh apply --type all            # все дайджесты (не только сегодня)
auto-hh apply --login               # режим логина (сохранить сессию)
```

| Флаг | Описание |
|------|----------|
| `-l, --limit <n>` | Сколько вакансий обработать |
| `-t, --type <type>` | `latest` (сегодня) или `all` (все дни) |
| `--login` | Открыть браузер для ручного входа на hh.ru |

### `schedule` — запуск поиска по расписанию

```bash
auto-hh schedule
```

Использует `schedule.cron` из config.json. Выводит расписание и следующую дату запуска. Работает до `Ctrl+C`.

### `grade` — AI-оценка резюме

```bash
auto-hh grade                       # оценить резюме по умолчанию
auto-hh grade --resume frontend     # оценить конкретное резюме
```

AI-рекрутер анализирует резюме: общая оценка (0–100), сильные/слабые стороны, детальный разбор по 9 категориям. Результат выводится в консоль и сохраняется в `resume-grade.md`.

### `cover` — письмо для одной вакансии

```bash
auto-hh cover 12345678              # сгенерировать письмо по ID вакансии
auto-hh cover 12345678 --resume dev # с конкретным резюме
```

### `digest` — показать последний дайджест

```bash
auto-hh digest                      # человекочитаемый вывод
auto-hh digest --json               # вывод в JSON
```

### `history` — история откликов

```bash
auto-hh history                     # список откликов и просмотренных
auto-hh history --json              # вывод в JSON
```

### `resume` — управление резюме

```bash
auto-hh resume list                 # показать все доступные резюме
auto-hh resume register frontend    # зарегистрировать резюме в MongoDB
```

### `config` — показать текущую конфигурацию

```bash
auto-hh config
```

### `reset` — полный сброс

```bash
auto-hh reset
```

Удаляет историю, кэш, дайджесты и rejected-файлы. Эквивалентно `search --reset`.

---

## ⚙️ config.json

```json
{
  "search": { … },
  "filter": { … },
  "api": { … },
  "apply": { … },
  "schedule": { … },
  "adaptResume": true
}
```

### `search` — параметры запроса к API hh.ru

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | `string` | Поисковая строка. Поддерживает `OR`, `AND`, скобки |
| `area` | `number[]` | ID регионов hh (например, `[1, 2]` — Москва + СПб; `null` — вся Россия) |
| `experience` | `string` | `noExperience`, `between1And3`, `between3And6`, `moreThan6` |
| `salary` | `number` | Минимальная зарплата |
| `currency` | `string` | `RUR`, `USD`, `EUR`… |
| `only_with_salary` | `boolean` | Только вакансии с указанной ЗП |
| `schedule` | `string` | `remote`, `flexible`, `fullDay`… (`null` — любой) |
| `employment` | `string` | `full`, `part`, `project`, `probation`… (`null` — любой) |
| `per_page` | `number` | Вакансий на странице (≤ 100) |
| `start_page` | `number` | С какой страницы начинать (0 — первая) |
| `max_pages` | `number` | Сколько страниц обойти от `start_page` |

### `filter` — локальный пре-фильтр

| Поле | Тип | Описание |
|------|-----|----------|
| `requiredSkills` | `string[]` | Хотя бы один навык должен быть в описании |
| `excludedKeywords` | `string[]` | Слова, при наличии которых вакансия отбрасывается |
| `excludedCompanies` | `string[]` | Игнорируемые компании |
| `excludeArchived` | `boolean` | Пропускать архивные вакансии |

### `api` — LLM-провайдер

| Поле | Тип | Описание |
|------|-----|----------|
| `baseUrl` | `string` | URL OpenAI-совместимого API (DeepSeek, OpenAI, и др.) |
| `apiKey` | `string` | API-ключ. Если не задан — читается из `OPENAI_API_KEY` или `ANTHROPIC_API_KEY` |

### `apply` — параметры отклика

| Поле | Тип | Описание |
|------|-----|----------|
| `maxPerRun` | `number` | Максимум вакансий в один дайджест |
| `dryRun` | `boolean` | Не генерировать письма |
| `minClaudeScore` | `number` | Порог score от AI (1–10), всё ниже отбрасывается |
| `coverLetterTemplate` | `string` | Шаблон письма-фолбэка. Плейсхолдеры: `{title}`, `{matchedSkills}` |

### `schedule` — планировщик

| Поле | Тип | Описание |
|------|-----|----------|
| `cron` | `string` | Cron-выражение (5 полей). Например: `"0 9 * * 1-5"` — будни в 9:00 |

### `adaptResume`

| Поле | Тип | Описание |
|------|-----|----------|
| `adaptResume` | `boolean` | Адаптировать резюме под вакансию перед отправкой AI-судье (по умолчанию `true`) |

---

## 🔐 Переменные окружения (`.env`)

### Общие

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `CONFIG_PATH` | `./config.json` | Альтернативный путь к конфигу |
| `HH_USER_AGENT` | `AutoHH/1.0` | User-Agent для API hh.ru — **рекомендуется указать ваш email** |
| `RESUME_PATH` | — | Путь к одному файлу резюме (`.txt`, `.md`, `.pdf`) |
| `RESUME_DIR` | — | Директория с резюме. Выбор через `--resume <name>` |
| `APPLICANT_PROFILE` | `опытный разработчик` | Фолбэк-описание, если резюме не задано |
| `REQUEST_DELAY_MS` | `1500` | Пауза между запросами к hh API (мс) |
| `MONGODB_URI` | `mongodb://localhost:27017/autohh` | URI MongoDB |
| `DEBUG` | — | Любое непустое значение включает `log.debug` |

### AI (Claude / OpenAI)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `ANTHROPIC_API_KEY` | — | API-ключ Anthropic. Если не задан — используется OpenAI |
| `OPENAI_API_KEY` | — | API-ключ OpenAI. Приоритет ниже `ANTHROPIC_API_KEY` |
| `CLAUDE_MODEL` | `claude-opus-4-7` | Модель для judge и cover-letter (можно указать любую OpenAI-совместимую) |
| `JUDGE_BATCH_SIZE` | `10` | Вакансий в одной пачке для AI-судьи |
| `COVER_BATCH_SIZE` | `20` | Писем за один AI-запрос |

### Playwright

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PW_USER_DATA_DIR` | `./data/browser-profile` | Директория профиля браузера (сессия hh.ru) |
| `PW_HEADLESS` | `false` | `true` — браузер без окна |
| `PW_MIN_DELAY_MS` | `500` | Мин. пауза между откликами (выбирается случайно) |
| `PW_MAX_DELAY_MS` | `2000` | Макс. пауза между откликами |
| `PW_TEST_MODE` | `manual` | `manual` — ждать ручного прохождения теста; `skip` — пропускать |
| `PW_TEST_TIMEOUT_MS` | `0` | Таймаут ожидания ручного теста (0 — без таймаута) |
| `PW_MANUAL_TIMEOUT_MS` | `300000` | Таймаут ожидания ручного нажатия «Откликнуться» |

### Устаревшие

`HH_CLIENT_ID`, `HH_CLIENT_SECRET`, `HH_REDIRECT_URI`, `HH_ACCESS_TOKEN`, `HH_REFRESH_TOKEN`, `HH_RESUME_ID` — для OAuth (соискательский API закрыт, не используются).

---

## 📁 Файлы в `data/`

| Файл | Содержимое |
|------|------------|
| `history.json` | Какие вакансии видели / куда откликались |
| `collected-YYYY-MM-DD.json` | Кэш страниц поиска, вердиктов и писем за дату |
| `digest-YYYY-MM-DD.json` | Подходящие вакансии с письмами |
| `rejected-YYYY-MM-DD.json` | Отбракованные AI вакансии с причинами |
| `browser-profile/` | Профиль Chromium (cookies, localStorage) |
| `apply-dom-*.html` | Дамп DOM (если Playwright не нашёл textarea) |
| `app.log` | Лог |

---

## 🗂️ Структура проекта

```
.
├── bin/                          # CLI entry point
├── config.json
├── .env
├── resumes/                      # директория с резюме
├── src/
│   ├── cli/                      # команды CLI
│   │   ├── index.ts              # регистрация команд (Commander)
│   │   ├── cmd-search.ts         # поиск → фильтр → judge → дайджест
│   │   ├── cmd-apply.ts          # автоотклик через Playwright
│   │   ├── cmd-cover.ts          # письмо для одной вакансии
│   │   ├── cmd-grade-resume.ts   # AI-оценка резюме
│   │   ├── cmd-resume.ts         # управление резюме (list/register)
│   │   ├── cmd-schedule.ts       # cron-планировщик
│   │   ├── cmd-digest.ts         # просмотр дайджеста
│   │   ├── cmd-history.ts        # история откликов
│   │   ├── cmd-config.ts         # просмотр конфига
│   │   └── cmd-reset.ts          # сброс данных
│   ├── judge/                    # AI-судья
│   │   ├── judge.ts              # оценка вакансий (одиночная + батч)
│   │   ├── system-text.ts        # промпт для оценки
│   │   └── index.ts
│   ├── cover-letter/             # генерация писем
│   │   ├── cover-letter.ts       # генерация (одиночная + батч)
│   │   ├── system-text.ts        # промпт для писем
│   │   └── index.ts
│   ├── types.ts                  # общие типы (Vacancy, Verdict, Resume…)
│   ├── ai-client.ts              # единый OpenAI-клиент + buildResumeBlock
│   ├── adapt-resume.ts           # адаптация резюме под вакансию
│   ├── grade-resume.ts           # AI-оценка резюме (AI-рекрутер)
│   ├── resume.ts                 # загрузка резюме (файл / директория)
│   ├── resume-store.ts           # MongoDB-хранилище резюме
│   ├── cache.ts                  # кэш в MongoDB
│   ├── filter.ts                 # локальный пре-фильтр
│   ├── hh-client.ts              # HTTP-клиент для API hh.ru
│   ├── digest-store.ts           # запись дайджеста (Markdown + MongoDB)
│   ├── history-store.ts          # история просмотров/откликов
│   ├── text-utils.ts             # stripHtml, parseJSON
│   ├── db.ts                     # MongoDB connection manager
│   ├── config.ts                 # загрузка конфига
│   ├── logger.ts                 # pino-логгер
│   ├── reset.ts                  # сброс данных
│   └── retry.ts                  # повтор при rate-limit / 5xx
└── migrations/                   # миграции MongoDB
```

---

## 🔄 Типичные сценарии

### Первый запуск

```bash
npm install && npx playwright install chromium
cp .env.example .env
# Добавьте API-ключ и путь к резюме в .env
npm run login                     # залогиньтесь в браузере
npm start                         # первый поиск
npm run apply -- --limit 3        # пробный отклик на 3 вакансии
```

### Ежедневный прогон

```bash
npm start                         # поиск + AI-оценка
# → смотрите дайджест: auto-hh digest
npm run apply -- --limit 10       # отклик на топ-10
```

### Автоматический режим (планировщик)

```bash
auto-hh schedule                  # запускает search по cron из config.json
```

### Оценка резюме

```bash
auto-hh grade                     # AI-рекрутер оценит резюме
# → результат в консоли и в resume-grade.md
```

### Точечное письмо

```bash
auto-hh cover 12345678            # письмо для конкретной вакансии
```

---

## ⚠️ Замечания

- **Лимит откликов:** ~200 в день на hh.ru, не превышайте.
- **Тестовые задания:** при `PW_TEST_MODE=manual` скрипт выводит окно браузера на передний план и ждёт `ENTER` в консоли — проходите тест руками, затем продолжаете.
- **Селекторы hh.ru:** со временем меняются. Если автоотклик перестал работать, смотрите `data/app.log` и обновляйте селекторы в `src/apply-playwright.ts`.
- **MongoDB:** используется для кэша, истории и дайджестов. Если MongoDB недоступен, кэш не работает, но основной функционал сохраняется (через файлы в `data/`).
- **AI-провайдер:** поддерживается любой OpenAI-совместимый API. Настройте `api.baseUrl` и `api.apiKey` в config.json, либо используйте `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` в `.env`.
