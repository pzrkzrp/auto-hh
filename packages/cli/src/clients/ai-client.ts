import OpenAI from "openai";
import type { Resume } from "../types";

// Локальный блок api из config.json — ключ и кастомный baseURL (например, DeepSeek).
export interface ApiConfig {
  apiKey?: string;
  baseUrl?: string;
}

let client: OpenAI | null = null;
let lastConfig: ApiConfig | null = null;

export function getClient(apiConfig?: ApiConfig): OpenAI | null {
  const cfg = apiConfig || {};
  if (client && lastConfig === apiConfig) return client;

  const key = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const opts: ConstructorParameters<typeof OpenAI>[0] = { apiKey: key, maxRetries: 3 };
  if (cfg.baseUrl) opts.baseURL = cfg.baseUrl;

  client = new OpenAI(opts);
  lastConfig = apiConfig || null;
  return client;
}

export function buildResumeBlock(resume: Resume | null, adaptedText: string | null = null): { type: 'text'; text: string } | null {
  if (!resume) return null;
  if (adaptedText) {
    return { type: 'text', text: `=== РЕЗЮМЕ СОИСКАТЕЛЯ (адаптированное под вакансию) ===\n${adaptedText}` };
  }
  if (resume.type === 'pdf') {
    return { type: 'text', text: `=== РЕЗЮМЕ СОИСКАТЕЛЯ (PDF) ===\n${resume.filename}` };
  }
  return { type: 'text', text: `=== РЕЗЮМЕ СОИСКАТЕЛЯ ===\n${resume.text}` };
}
