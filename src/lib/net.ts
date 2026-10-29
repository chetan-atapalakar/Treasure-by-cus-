export class TimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TimeoutError";
  }
}

export class DataError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "DataError";
    this.code = code;
  }
}

/** Every network operation gets a timeout so nothing can load forever. */
export function withTimeout<T>(work: PromiseLike<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new TimeoutError()), ms);
    Promise.resolve(work).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

interface ProviderError {
  code?: string;
  message?: string;
}

/** Converts a provider error into a safe, friendly message (never leaks internals). */
export function fail(error: ProviderError, fallback: string): never {
  const code = error.code ?? "";
  if (code === "23503") throw new DataError("That item is still used by other records, so it cannot be removed.", code);
  if (code === "23505") throw new DataError("That already exists.", code);
  if (code === "42501" || code === "PGRST301" || code === "PGRST303") {
    throw new DataError("Your session may have expired. Please sign in again.", code);
  }
  throw new DataError(fallback, code);
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof DataError) return e.message;
  if (e instanceof TimeoutError) return "That took too long. Check your connection and try again.";
  return fallback;
}