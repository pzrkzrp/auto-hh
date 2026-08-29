export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface DigestEntry {
  id: string;
  title: string;
  employer: string;
  area: string;
  salary: string;
  url: string;
  matchedSkills: string[];
  score: number;
  reason: string | null;
  coverLetter: string;
}

export interface QueueItem {
  _id: string;
  userId: string;
  resumeId?: string | null;
  vacancyId: string;
  title: string;
  employer: string;
  url: string;
  salary: string;
  area: string;
  score: number | null;
  coverLetter: string | null;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'skipped';
  errorMessage: string | null;
  addedAt: string;
  processedAt: string | null;
}

export interface ResumeDoc {
  resumeId: string;
  name: string;
  filename: string;
  userId: string;
  createdAt: string;
}

// Конфиг для списка на /config.
export interface ConfigSummary {
  _id: string;
  name: string;
  updatedAt: string;
}

// Полный документ конфига (GET/PUT /api/config/:id).
export interface ConfigDoc {
  _id: string;
  userId: string;
  name?: string;
  search: SearchConfig;
  filter: FilterConfig;
  apply: ApplyConfig;
  adaptResume: boolean;
  resume: string | null;
  schedule?: { cron?: string; enabled?: boolean };
  updatedAt: string;
}

export interface SearchConfig {
  text: string;
  area: number[] | null;
  experience?: string;
  salary?: number;
  currency?: string;
  only_with_salary: boolean;
  schedule: string | null;
  employment: string | null;
  per_page: number;
  start_page: number;
  max_pages: number;
}

export interface FilterConfig {
  titleKeywords: string[];
  descriptionKeywords: string[];
  requiredSkills?: string[];
  excludedKeywords: string[];
  excludedCompanies: string[];
  excludeArchived: boolean;
}

export interface ApplyConfig {
  maxPerRun: number;
  dryRun: boolean;
  minClaudeScore: number;
  coverLetterTemplate: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore?: boolean;
  page?: number;
  totalPages?: number;
}
