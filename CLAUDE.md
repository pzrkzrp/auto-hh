# auto-hh — монорепозиторий

Автоматизация поиска, AI-оценки и откликов на вакансии hh.ru.

## Структура

npm workspaces (`packages/*`):

| Пакет | Назначение | Стек |
|---|---|---|
| `packages/cli` | CLI-агент: поиск, оценка, отклики через Playwright | Node, commander, Playwright, @anthropic-ai/sdk, bullmq |
| `packages/backend` | REST API для веб-фронтенда | NestJS 11, Mongoose, @nestjs/bullmq, JWT, Swagger |
| `packages/frontend` | Веб-интерфейс | Angular 22 (standalone, lazy), Angular Material |
| `packages/shared` | `@auto-hh/shared` — контракт backend ↔ CLI | TS типы payload'ов + имена BullMQ-очередей |

**Важно:** `shared` — единственный источник правды для типов джоб и имён очередей. Менять их только там, а не по месту.

## Архитектура и поток данных

```
Frontend (4200) ──REST──▶ Backend NestJS (3001, Swagger /api/docs)
                                │  кладёт джобы в BullMQ
                                ▼
                          Redis (6379)
                                ▲
                    CLI-воркер  │  (auto-hh apply --worker / search --worker)
```

- Backend и CLI общаются **только через BullMQ-очереди** (`apply`, `search`) в общем Redis.
- Backend пишет джобу → CLI-воркер слушает и выполняет (поиск на hh.ru, Playwright-отклик) → пишет статусы обратно в **MongoDB web-autohh**.
- Модель `apply_queue` в backend — источник правды по статусам откликов.

## Базы и инфраструктура

`docker-compose.yml` поднимает: mongo:7 (27017), mongo-express (8081, `admin`/`admin`), redis:7.2-alpine (6379).

- **Две MongoDB-базы:** CLI работает с `autohh`, backend — с `web-autohh` (заданы в `.env` каждого пакета).
- **Redis требует пароль** (`--requirepass your_strong_password_here`). `REDIS_URL` обоих пакетов обязан нести пароль: `redis://:пароль@localhost:6379`. Кэш backend'а терпит недоступность Redis, а apply-queue/search — нет.

## Команды (из корня репо)

```bash
npm run backend:start     # NestJS в watch-режиме
npm run frontend:start    # Angular dev-server (4200)
npm run build             # сборка CLI (shared собирается через prebuild)
npm run apply             # CLI: отклики
npm run login             # CLI: вход в hh.ru (Playwright headful)
npm run schedule          # CLI: запуск по расписанию
npm run migrate:up        # migrate-mongo (пакет cli)
```

CLI-воркеры (слушают BullMQ): `auto-hh apply --worker`, `auto-hh search --worker` (npm run в `packages/cli`).

## Конфигурация

- `packages/backend/.env` ← пример в `.env.example`: `MONGODB_URI`, `PORT` (3001), `CORS_ORIGIN`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` (AES-256 для токенов hh.ru), `REDIS_URL`, `RESUME_DIR`.
- `packages/cli/.env` ← пример в `.env.example`: `HH_USER_AGENT`, `PW_*` (Playwright, задержки между откликами), `ANTHROPIC_API_KEY` + `CLAUDE_MODEL`, `RESUME_PATH`/`RESUME_DIR`, `MONGODB_URI` (autohh), `MONGODB_WEB_URI`, `REDIS_URL`.
- Помимо env есть `config.json` (`CONFIG_PATH`) — настройки поиска/фильтров/откликов CLI.

## Подводные камни

- В коде backend есть **dev-fallback для `JWT_SECRET` и `ENCRYPTION_KEY`** — вне локальной разработки задавать явно.
- Модели Mongoose в backend живут в `src/*/*.schema.ts`, схемы CLI — в `src/store/*` + `src/types.ts`.
- `shared` требует сборки перед backend/cli (`tsc -p ../shared/tsconfig.json` в `prebuild`). После изменения типов — пересобрать shared, иначе импорт в dist устареет.
- Кэш поиска/дайджестов backend'а — `src/common/redis/redis-cache.service.ts`.
- `.claude/` и `.env` в `.gitignore` — конфиг агента и секреты в git не попадают.
