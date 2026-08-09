import OpenAI from "openai";
import log from "./logger.js";

async function retryOnTransient<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (attempt >= maxRetries) throw err;
      if (err instanceof Error) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        log.debug(`retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

export { retryOnTransient };
