// Утилиты для работы с ошибками.

// Безопасное извлечение текста из неизвестного значения в catch-блоках.
export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
