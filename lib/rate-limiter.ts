const requests = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60000; // 1 minuto
const MAX_REQUESTS = 100; // 100 por minuto

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requests.get(ip);

  if (!record || now > record.resetTime) {
    requests.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Limpiar entradas antiguas cada 5 minutos
if (typeof global !== 'undefined') {
  const globalAny = global as any;
  if (!globalAny._rateLimiterInterval) {
    globalAny._rateLimiterInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of requests.entries()) {
        if (now > record.resetTime) {
          requests.delete(ip);
        }
      }
    }, 300000);
    // Evitar que prevenga la finalización del proceso en scripts cortos/tests
    if (globalAny._rateLimiterInterval.unref) {
      globalAny._rateLimiterInterval.unref();
    }
  }
}
