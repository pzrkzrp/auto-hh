// Текстовые утилиты: очистка HTML и парсинг JSON из ответов моделей.

export function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseJSON(text: string): unknown {
  if (!text) return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.replace(/^\*\*+/, '').replace(/\*\*+$/, '');
  return JSON.parse(cleaned);
}

// Устойчивый вариант parseJSON: помимо обрезки code-fence умеет чинить
// неэкранированные кавычки и управляющие символы в ответе модели.
export function safeJsonParse(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  cleaned = cleaned.replace(/^\*\*+/, "").replace(/\*\*+$/, "");
  // Попытка распарсить как есть
  try {
    return JSON.parse(cleaned);
  } catch {
    // Если не вышло — экранируем неэкранированные кавычки внутри строк
    // (грубая эвристика: заменяем " внутри значений на «»)
    cleaned = cleaned.replace(
      /: "([^"]*?)"([^,\]\}])/g,
      (_m, p1, p2) => `: "${p1.replace(/"/g, "«")}"${p2}`
    );
    try {
      return JSON.parse(cleaned);
    } catch {
      // Последняя попытка: удалить управляющие символы
      cleaned = cleaned.replace(/[\x00-\x1f]/g, " ");
      return JSON.parse(cleaned);
    }
  }
}
