const API_URL = 'https://api.frankfurter.dev/v1/latest';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry { rate: number; fetchedAt: string; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

export class ExchangeRateError extends Error {
  constructor(message: string) { super(message); this.name = 'ExchangeRateError'; }
}

export async function fetchToCny(currency: string, timeoutMs = 8000): Promise<CacheEntry> {
  if (currency === 'CNY') return { rate: 1, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + CACHE_TTL_MS };
  const cached = cache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const existing = pending.get(currency);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params = new URLSearchParams({ base: currency, symbols: 'CNY' });
      const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new ExchangeRateError(`汇率服务返回 HTTP ${response.status}`);
      const data: unknown = await response.json();
      const rate = parseRate(data);
      if (!Number.isFinite(rate) || rate <= 0) throw new ExchangeRateError('汇率响应格式无效');
      const entry = { rate, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + CACHE_TTL_MS };
      cache.set(currency, entry);
      return entry;
    } catch (error) {
      if (error instanceof ExchangeRateError) throw error;
      if ((error as Error).name === 'AbortError') throw new ExchangeRateError('汇率请求超时');
      throw new ExchangeRateError('无法连接汇率服务');
    } finally {
      window.clearTimeout(timer);
      pending.delete(currency);
    }
  })();
  pending.set(currency, request);
  return request;
}

function parseRate(data: unknown): number {
  if (Array.isArray(data)) {
    const item = data.find((entry) => typeof entry === 'object' && entry !== null && (entry as { quote?: string }).quote === 'CNY');
    return Number((item as { rate?: number } | undefined)?.rate);
  }
  if (typeof data === 'object' && data !== null) {
    const record = data as { rate?: number; rates?: Record<string, number> };
    return Number(record.rate ?? record.rates?.CNY);
  }
  return NaN;
}

export async function fetchRequiredRates(renewalCurrency: string, pushCurrency: string): Promise<{ renewalToCny: number; pushToCny: number; fetchedAt: string }> {
  const currencies = [...new Set([renewalCurrency, pushCurrency])];
  const entries = await Promise.all(currencies.map((currency) => fetchToCny(currency)));
  const byCurrency = new Map(currencies.map((currency, index) => [currency, entries[index]]));
  return {
    renewalToCny: byCurrency.get(renewalCurrency)!.rate,
    pushToCny: byCurrency.get(pushCurrency)!.rate,
    fetchedAt: entries.map((entry) => entry.fetchedAt).sort().at(-1)!,
  };
}
