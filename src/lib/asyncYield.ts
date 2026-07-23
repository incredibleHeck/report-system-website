/** Yield to the event loop so GC can run between heavy PDF renders. */
export function yieldToBrowser(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number; shouldRetry?: (err: unknown) => boolean } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const delayMs = opts.delayMs ?? 600;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retry = opts.shouldRetry?.(err) ?? true;
      if (!retry || attempt === retries) break;
      await yieldToBrowser(delayMs * (attempt + 1));
    }
  }
  throw lastErr;
}
