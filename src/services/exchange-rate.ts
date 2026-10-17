const API_URL = 'https://api.frankfurter.dev/v2/rates';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry { rate: number; fetchedAt: string; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

export class ExchangeRateError extends Error {
  constructor(message: string) { super(message); this.name = 'ExchangeRateError'; }
}

/** 币种不受支持或没有可用汇率；必须继承 ExchangeRateError，否则调用方的类型判断会把文案吞掉。 */
export class UnsupportedCurrencyError extends ExchangeRateError {
  constructor(currency: string) {
    super(`${currency} 暂无可用的人民币汇率，请换一个币种`);
    this.name = 'UnsupportedCurrencyError';
  }
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
      const params = new URLSearchParams({ base: currency, quotes: 'CNY' });
      const response = await fetch(`${API_URL}?${params}`, { signal: controller.signal });
      if (response.status === 422) throw new UnsupportedCurrencyError(currency);
      if (!response.ok) throw new ExchangeRateError(`汇率服务返回 HTTP ${response.status}`);
      const data: unknown = await response.json();
      const rate = parseRate(data);
      if (rate === undefined) throw new UnsupportedCurrencyError(currency);
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

/** 返回 CNY 汇率；返回 undefined 表示响应里根本没有 CNY 汇率（上游摘除该币种时的实际表现），NaN 表示响应格式无效。 */
function parseRate(data: unknown): number | undefined {
  if (!Array.isArray(data)) return Number.NaN;
  const item = data.find((entry) => typeof entry === 'object' && entry !== null && (entry as { quote?: string }).quote === 'CNY');
  if (!item) return undefined;
  return Number((item as { rate?: number }).rate);
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
