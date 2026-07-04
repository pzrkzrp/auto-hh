// Shared types mirroring ../src/types.ts for backend use

export interface Vacancy {
  id: number | string;
  name: string;
  description: string;
  key_skills?: { name: string }[];
  salary?: { from?: number; to?: number; currency?: string };
  employer?: { name?: string };
  area?: { name?: string };
  experience?: { name?: string };
  schedule?: { name?: string };
  employment?: { name?: string };
  alternate_url?: string;
  snippet?: { requirement?: string; responsibility?: string };
  [key: string]: unknown;
}

export interface Verdict {
  vacancyId: string;
  fit: boolean;
  score: number;
  reason: string | null;
  comment: string | null;
  coverLetter: string;
}

export interface Resume {
  name: string;
  id: string;
  type: 'text' | 'pdf';
  text?: string;
  data?: string;
  filename: string;
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

export interface DigestDoc {
  date: string;
  entries: DigestEntry[];
}

export interface RejectedEntry {
  id: string;
  title: string;
  employer: string;
  area: string;
  salary: string;
  url: string;
  score: number;
  reason: string;
  redFlags: string[];
}

export interface UserConfig {
  userId: string;
  search: SearchConfig;
  filter: FilterConfig;
  apply: ApplyConfig;
  adaptResume: boolean;
  updatedAt: Date;
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
  requiredSkills: string[];
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

export interface GradeResult {
  overallScore: number;
  overallAssessment: string;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  recommendations: string[];
  categoryScores: Record<string, { score: number; max: number }>;
  detailedAnalysis: Array<{
    category: string;
    status: 'good' | 'attention';
    description: string;
    quotes: string[];
    recommendations?: string[];
  }>;
}
