// Контракт apply между backend (POST /api/apply-queue) и CLI-воркером
// (auto-hh apply --worker). Backend кладёт джобу в BullMQ-очередь 'apply',
// CLI слушает её. Единственный источник правды для типа — здесь.

/** Имя BullMQ-очереди откликов. Литерал, совпадает в обоих пакетах. */
export const APPLY_QUEUE = 'apply';

/** Payload BullMQ-джобы отклика. queueId — это же Mongo _id документа apply_queue. */
export interface ApplyJobData {
  queueId: string;
  userId: string;
  /** Резюме, которым откликаемся (resumeId из коллекции resumes / конфига юзера). */
  resumeId: string | null;
  vacancyId: string;
  title: string;
  employer: string;
  url: string;
  salary: string;
  area: string;
  score: number | null;
  coverLetter: string | null;
}
