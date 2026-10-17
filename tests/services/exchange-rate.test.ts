import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const arrayResponse = (rate: number, base = 'USD') => new Response(JSON.stringify([
  { date: '2026-10-17', base, quote: 'CNY', rate },
]), { status: 200 });

const loadAdapter = () => import('../../src/services/exchange-rate');

describe('Frankfurter v2 汇率适配器', () => {
  it('走 /v2/rates 并用 quotes 参数取 CNY 汇率', async () => {
    const fetchMock = vi.fn().mockResolvedValue(arrayResponse(4.35, 'TWD'));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchToCny } = await loadAdapter();
    const result = await fetchToCny('TWD');

    expect(result.rate).toBe(4.35);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rates?base=TWD&quotes=CNY',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('人民币不请求远程接口', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fetchToCny } = await loadAdapter();
    const result = await fetchToCny('CNY');

    expect(result.rate).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('422 归为币种不受支持，文案带上本次请求的币种代码', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid currency: ZZZ', { status: 422 })));

    const { fetchToCny, UnsupportedCurrencyError, ExchangeRateError } = await loadAdapter();

    await expect(fetchToCny('ZZZ')).rejects.toBeInstanceOf(UnsupportedCurrencyError);
    await expect(fetchToCny('ZZZ')).rejects.toBeInstanceOf(ExchangeRateError);
    await expect(fetchToCny('ZZZ')).rejects.toThrow('ZZZ');
  });

  it('200 但响应里没有 CNY 汇率时同样归为币种不受支持', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))));

    const { fetchToCny, UnsupportedCurrencyError } = await loadAdapter();

    await expect(fetchToCny('VEF')).rejects.toBeInstanceOf(UnsupportedCurrencyError);
    await expect(fetchToCny('VEF')).rejects.toThrow('VEF');
  });

  it('200 但响应不是数组时归为格式无效，而不是让用户换币种', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'not an array' }), { status: 200 })));

    const { fetchToCny, ExchangeRateError, UnsupportedCurrencyError } = await loadAdapter();

    await expect(fetchToCny('USD')).rejects.toThrow('汇率响应格式无效');
    await expect(fetchToCny('USD')).rejects.not.toBeInstanceOf(UnsupportedCurrencyError);
    await expect(fetchToCny('USD')).rejects.toBeInstanceOf(ExchangeRateError);
  });

  it('200 但汇率是 0 时同样归为格式无效', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(arrayResponse(0)));

    const { fetchToCny, UnsupportedCurrencyError } = await loadAdapter();

    await expect(fetchToCny('USD')).rejects.toThrow('汇率响应格式无效');
    await expect(fetchToCny('USD')).rejects.not.toBeInstanceOf(UnsupportedCurrencyError);
  });

  it('其余 HTTP 失败维持原文案', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    const { fetchToCny, ExchangeRateError, UnsupportedCurrencyError } = await loadAdapter();

    await expect(fetchToCny('USD')).rejects.toThrow('汇率服务返回 HTTP 500');
    await expect(fetchToCny('USD')).rejects.not.toBeInstanceOf(UnsupportedCurrencyError);
    await expect(fetchToCny('USD')).rejects.toBeInstanceOf(ExchangeRateError);
  });

  it('网络失败与超时维持原有文案', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const network = await loadAdapter();
    await expect(network.fetchToCny('USD')).rejects.toThrow('无法连接汇率服务');

    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    const timedOut = await loadAdapter();
    await expect(timedOut.fetchToCny('USD')).rejects.toThrow('汇率请求超时');
  });

  it('同一币种命中缓存只发一次请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(arrayResponse(7));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchToCny } = await loadAdapter();
    const first = await fetchToCny('USD');
    const second = await fetchToCny('USD');

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('同一币种的并发请求被去重', async () => {
    const fetchMock = vi.fn().mockResolvedValue(arrayResponse(7));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchToCny } = await loadAdapter();
    const [first, second] = await Promise.all([fetchToCny('USD'), fetchToCny('USD')]);

    expect(first.rate).toBe(7);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
