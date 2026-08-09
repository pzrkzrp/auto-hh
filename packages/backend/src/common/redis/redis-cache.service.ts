import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Тонкая обёртка над ioredis для кэширования. Redis — опциональный слой:
// если сервер недоступен, все методы молча возвращают «кэша нет» и приложение
// продолжает работать без кэша (данные читаются напрямую из Mongo).
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    this.client.on('error', () => {
      /* обрывы и старт без Redis переживаем молча */
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* ignore */
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      /* ignore */
    }
  }
}
