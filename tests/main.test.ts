import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatorInput } from '../src/domain/types';
import { encodeSharePayload } from '../src/services/share-codec';

const input: CalculatorInput = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '测试商家', productName: '东京套餐', highlight: '高性能', cpu: '2 核', memory: '4', memoryUnit: 'GB',
  storage: '80', storageUnit: 'GB', bandwidth: '1', bandwidthUnit: 'Gbps', traffic: '2', trafficUnit: 'TB',
  trafficResetCycle: 'monthly', trafficDirection: 'double', location: '日本东京',
};

const ratesResponse = (rate: number, base: string) => new Response(
  JSON.stringify([{ date: '2026-10-17', base, quote: 'CNY', rate }]),
  { status: 200 },
);

const triggerOf = (id: string) => document.getElementById(id) as HTMLInputElement;
const searchOf = (id: string) => document.getElementById(`${id}-search`) as HTMLInputElement;
const resultContainer = () => document.querySelector<HTMLElement>('#result-container')!;

const commitCurrency = (id: string, query: string) => {
  triggerOf(id).click();
  const search = searchOf(id);
  search.value = query;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
};

async function boot(hash = '') {
  window.location.hash = hash;
  document.body.innerHTML = '<div id="app"></div>';
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ratesResponse(7, 'USD')));
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  await import('../src/main');
  return fetchMock;
}

const settle = async (fetchMock: ReturnType<typeof vi.fn>) => {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await vi.waitFor(() => expect(document.querySelector('#result-panel')).not.toBeNull());
};

beforeEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('表单与汇率的接线', () => {
  it('提交币种只刷新一次汇率，其余字段变更不请求汇率', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('base=USD');

    fetchMock.mockClear();
    commitCurrency('renewal-currency', 'tw');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('base=TWD');

    const amount = triggerOf('renewal-amount');
    amount.value = '20';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('汇率返回前把结果区换成加载占位，不留上一币种的金额与导出入口', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);
    expect(resultContainer().querySelector('#share-button')).not.toBeNull();
    expect(resultContainer().textContent).toContain('¥');

    let resolveRate: (value: Response) => void = () => {};
    fetchMock.mockClear();
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { resolveRate = resolve; }));
    commitCurrency('renewal-currency', 'tw');

    expect(resultContainer().querySelector('#share-button')).toBeNull();
    expect(resultContainer().querySelector('#image-button')).toBeNull();
    expect(resultContainer().querySelector('#markdown-button')).toBeNull();
    expect(resultContainer().textContent).toContain('正在获取汇率');
    expect(resultContainer().textContent).not.toContain('¥');

    resolveRate(ratesResponse(4.3, 'TWD'));
    await vi.waitFor(() => expect(resultContainer().querySelector('#share-button')).not.toBeNull());
    expect(resultContainer().textContent).toContain('¥');
  });

  it('汇率失败时换成失败占位并指出恢复动作，输入不丢、导出入口不残留', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);

    fetchMock.mockImplementation(() => Promise.resolve(new Response('invalid currency: EUR', { status: 422 })));
    commitCurrency('renewal-currency', 'eur');

    await vi.waitFor(() => expect(resultContainer().textContent).toContain('汇率获取失败'));
    expect(resultContainer().querySelector('#share-button')).toBeNull();
    expect(resultContainer().querySelector('#markdown-output')).toBeNull();
    expect(resultContainer().querySelector('.result-panel')).toBeNull();
    expect(resultContainer().textContent).toContain('重置');
    expect(triggerOf('renewal-currency').value).toBe('EUR');
    expect(triggerOf('renewal-amount').value).not.toBe('');
  });

  it('分享链接只渲染分享视图，不受下拉组件影响', async () => {
    const fetchMock = await boot(encodeSharePayload(input));
    await vi.waitFor(() => expect(document.querySelector('#result-panel')).not.toBeNull());

    expect(document.querySelector('#calculator-form')).toBeNull();
    expect(document.querySelector('#renewal-currency')).toBeNull();
    expect(document.body.textContent).toContain('东京套餐');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
