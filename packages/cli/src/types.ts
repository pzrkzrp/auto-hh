export interface Vacancy {
  id: number | string;
  name: string;
  description: string;
  key_skills?: { name: string }[];
  // Поля hh.ru могут отсутствовать или быть null — поэтому nullable, а не только optional.
  salary?: { from?: number; to?: number; currency?: string } | null;
  employer?: { name?: string } | null;
  area?: { name: string, id: number } | null;
  experience?: { name?: string } | null;
  schedule?: { name?: string } | null;
  employment?: { name?: string } | null;
  alternate_url?: string;
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

export interface JudgeOpts {
  minScore?: number;
  adaptResume?: boolean;
  [key: string]: unknown;
}

export interface Resume {
  name: string;
  id: string;
  type: 'text' | 'pdf';
  text?: string;
  data?: string;
  filename: string;
}

export interface DigestDoc {
  date: string;
  entries: DigestEntry[];
}

export interface DigestEntry {
  id: string;
  title: string;
  employer: string;
  area: string;
  salary: string;
  url: string;
  score: number | null; // null — когда Claude-судья не использовался
  reason: string | null;
  comment: string | null;
  coverLetter: string;
}
