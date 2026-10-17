import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Frankfurter 汇率适配器', () => {
  it('通过 Frankfurter 直连接口请求 CNY 汇率，避免 .app 重定向 CORS 错误', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      amount: 1,
      base: 'USD',
      date: '2026-09-10',
      rates: { CNY: 7.12 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchToCny } = await import('../../src/services/exchange-rate');
    const result = await fetchToCny('USD');

    expect(result.rate).toBe(7.12);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('人民币不请求远程接口', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fetchToCny } = await import('../../src/services/exchange-rate');
    const result = await fetchToCny('CNY');

    expect(result.rate).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
