// Контракт search между backend (POST /api/search/jobs) и CLI-воркером
// (auto-hh search --worker). Backend кладёт джобу в BullMQ-очередь 'search',
// CLI слушает её. Единственный источник правды для типа — здесь.

/** Имя BullMQ-очереди поиска. Литерал, совпадает в обоих пакетах. */
export const SEARCH_QUEUE = 'search';

/** Параметры поиска, передаваемые из backend в CLI-воркер в payload джобы. */
export interface SearchConfig {
  search?: {
    text?: string;
    area?: number[];
    experience?: string;
    salary?: number;
    only_with_salary?: boolean;
    currency?: string;
    per_page?: number;
    start_page?: number;
    max_pages?: number;
    schedule?: string | null;
    employment?: string | null;
  };
  filter?: {
    requiredSkills?: string[];
    excludedKeywords?: string[];
    excludedCompanies?: string[];
    excludeArchived?: boolean;
  };
  apply?: {
    maxPerRun?: number;
    dryRun?: boolean;
    minClaudeScore?: number;
    coverLetterTemplate?: string;
  };
  adaptResume?: boolean;
}

/** Payload BullMQ-джобы поиска. jobId — это же Mongo _id документа search_jobs. */
export interface SearchJobPayload {
  jobId: string;
  userId: string;
  config?: SearchConfig;
}
