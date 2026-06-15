function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function runProviderCall<T>(label: string, call: () => Promise<T>) {
  const retries = Math.max(0, envNumber("AI_PROVIDER_RETRIES", 1));
  const timeoutMs = envNumber("AI_PROVIDER_TIMEOUT_MS", 45_000);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await withTimeout(call(), timeoutMs, label);
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(Math.min(2_000 * (attempt + 1), 10_000));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
}
