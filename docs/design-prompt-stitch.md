# Промпт для Google Stitch — auto-hh

Промпт для https://stitch.withgoogle.com — вставьте его в поле ввода целиком.
Stitch генерирует набор редактируемых экранов (артбордов) как единое приложение.

---

Build a desktop web dashboard app for **auto-hh** — a personal AI assistant that automates job searching, AI-scoring and auto-applying to vacancies on hh.ru (the biggest Russian job board). The user links their hh.ru account, uploads resumes, sets up search configurations (queries, filters, cover-letter templates), and the system searches vacancies in the background, scores them by AI on a 0–10 scale and auto-applies to the best matches. The UI is a control center / dashboard, not a marketing site. All interface text must be in **Russian**.

**Target users:** developers and IT specialists looking for a job. Tone: professional, technical, calm — like a well-organized ops dashboard.

## Design language

- Desktop web app with a **dark gradient sidebar** on the left (indigo navy `#18234d → #2b3a7a` with soft cyan/indigo radial glows), light content area on the right.
- Brand: robot emoji logo, name **auto-hh**, subtitle «HR-ассистент», green pulsing "in progress" status dot with live indicator in the sidebar footer.
- Accent colors: indigo `#5a7dff`, cyan `#00d4ff` (used sparingly for active nav item, CTA buttons, logo). Semantic colors for statuses/scores: green, orange, red, blue, grey.
- Material Design (M3) components: cards, buttons, chips, tabs, text fields, badges, dialogs, snackbars, toggles.
- Cards: 12px rounded corners, thin `#e0e0e0` border, soft shadow. Spacious but dense grid (8/12/16/24px spacing).
- Support both **light and dark theme** for the same screens (dark: dark surfaces `#1e1e1e`, `rgba()` translucent chips).
- Sidebar navigation grouped into sections: «Обзор» (Дашборд, Дайджест, Отклики, История), «Вакансии» (Поиск), «Резюмейкер» (Резюме, Оценка), «Система» (Настройки, Конфиг).

## Screens to generate

1. **Вход / Регистрация** — centered auth card on a dark gradient background: email + password fields, primary button, validation errors, loading spinner state, link to registration.
2. **Дашборд (Dashboard)** — 4 stat cards in a row («Просмотрено», «Откликов», «Сегодня», «В очереди») and a «Последний дайджест» block: vacancy cards with circular score badge (green ≥8 / orange 6–7.9 / red <6), job title, employer, salary.
3. **Дайджест (Digest)** — grouped vacancy list: score badge, title, company, salary, matched-skills chips, cover-letter preview, link to the vacancy on hh.ru.
4. **Отклики (Apply queue)** — queue with status filter tabs: candidate, vacancy, time, status pill badges (queued blue / processing orange / success green / failed red / skipped grey), retry/cancel actions, progress bar of the current run.
5. **История (History)** — timeline of events/applications with dates, statuses and a date-range filter.
6. **Поиск (Search)** — run/manage search: config selector, checkboxes, run button, live worker status, search results list.
7. **Резюме (Resumes)** — card grid of resumes (name, filename, date), «Загрузить» upload button (.md/.txt/.pdf), delete action, rename dialog.
8. **Оценка (Grade)** — AI resume-vs-vacancy scoring screen: big score display, matched/missing skills lists, verdict.
9. **Конфиг (Config)** — list of saved search configs with «Создать / Редактировать / Удалить» actions.
10. **Конфиг (Config editor)** — tabbed editor: «Поиск» (query, pages), «Фильтр» (skills, excluded words/companies, exclude archived toggle), «Отклик» (max per digest, min AI-score, cover-letter template textarea), «Резюме» (resume select).
11. **Настройки (Settings)** — connect hh.ru account flow (phone/email, code from SMS/email or password) + list of connected accounts with delete.

## Requirements

- Generate all screens as one cohesive app with shared sidebar/header navigation between them.
- Use realistic Russian sample content: vacancy titles like «Backend-разработчик (Python)», salaries «от 250 000 ₽», companies like «Яндекс», «Т-Банк», «Ozon», «Сбер».
- Show states where natural: skeleton loading cards, empty states with an icon + CTA button, error banners.
- Use Material Icons for UI elements.
