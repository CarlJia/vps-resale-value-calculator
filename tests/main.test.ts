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
const popupOf = (id: string) => document.getElementById(`${id}-popup`) as HTMLElement;
const resultContainer = () => document.querySelector<HTMLElement>('#result-container')!;

const commitCurrency = (id: string, query: string) => {
  triggerOf(id).click();
  const search = searchOf(id);
  search.value = query;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
};

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

async function boot(hash = '', fetchImpl?: () => Promise<Response>) {
  window.location.hash = hash;
  document.body.innerHTML = '<div id="app"></div>';
  const fetchMock = vi.fn().mockImplementation(fetchImpl ?? (() => Promise.resolve(ratesResponse(7, 'USD'))));
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
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
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

  it('分享视图的汇率失败占位只给分享页能做的事，并把失败原因写进占位', async () => {
    await boot(encodeSharePayload(input), () => Promise.resolve(new Response('invalid currency: USD', { status: 422 })));

    await vi.waitFor(() => expect(resultContainer().textContent).toContain('汇率获取失败'));
    const text = resultContainer().textContent ?? '';
    expect(text).toContain('请稍后重新打开此链接');
    expect(text).toContain('请换一个币种'); // 失败原因不再只走分享页不存在的 #alert
    expect(text).not.toContain('点击重置');
    expect(document.querySelector('#alert')).toBeNull();
  });

  it('汇率成功但输入无效时，结果区不再停在加载占位', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);

    const cycle = document.getElementById('payment-cycle') as HTMLInputElement;
    cycle.value = '';
    cycle.dispatchEvent(new Event('input', { bubbles: true }));

    fetchMock.mockClear();
    commitCurrency('renewal-currency', 'tw');

    await vi.waitFor(() => expect(resultContainer().textContent).toContain('输入待修正'));
    expect(resultContainer().textContent).toContain('付款周期必须是大于 0 的数字');
    expect(resultContainer().textContent).not.toContain('正在获取汇率');
    expect(resultContainer().querySelector('.result-panel')).toBeNull();
  });

  it('重置会关掉开着的币种弹层，并把余额与续费币种恢复默认', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);

    commitCurrency('renewal-currency', 'tw');
    const balance = document.getElementById('account-balance') as HTMLInputElement;
    balance.value = '12.5';
    balance.dispatchEvent(new Event('input', { bubbles: true }));

    // 刻意在弹层打开的状态下复位：这样「弹层关闭」才是被复位动作保证的，而不是提交币种时顺手关掉的。
    triggerOf('renewal-currency').click();
    expect(popupOf('renewal-currency').classList.contains('hidden')).toBe(false);

    document.getElementById('reset-button')!.click();

    expect(balance.value).toBe('0');
    expect(popupOf('renewal-currency').classList.contains('hidden')).toBe(true);
    expect(triggerOf('renewal-currency').value).toBe('USD');
    expect(document.getElementById('balance-currency')!.textContent).toBe('USD');
  });

  it('续费币种提交后，余额币种提示立即跟随', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);
    expect(document.getElementById('balance-currency')!.textContent).toBe('USD');

    commitCurrency('renewal-currency', 'tw');

    expect(document.getElementById('balance-currency')!.textContent).toBe('TWD');
  });
});

describe('导出按钮的点击反馈', () => {
  const buttonOf = (id: string) => document.getElementById(id) as HTMLButtonElement;

  it('复制分享链接、复制 Markdown 都就地变成已复制，图片失败也有明确反馈', async () => {
    const fetchMock = await boot();
    await settle(fetchMock);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    const share = buttonOf('share-button');
    const markdown = buttonOf('markdown-button');
    const image = buttonOf('image-button');

    share.click();
    await vi.waitFor(() => expect(share.textContent).toBe('已复制链接'));
    expect(share.classList.contains('done')).toBe(true);
    expect(document.getElementById('alert')!.textContent).toContain('分享链接已复制');

    markdown.click();
    await vi.waitFor(() => expect(markdown.textContent).toBe('已复制 Markdown'));
    expect(markdown.classList.contains('done')).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(2);

    // jsdom 没有 canvas，图片导出必然失败；这里要的是「失败也不能没反应」，不是图片本身。
    image.click();
    await vi.waitFor(() => expect(image.textContent).toBe('导出失败'));
    expect(image.classList.contains('failed')).toBe(true);
    expect(document.getElementById('alert')!.textContent).not.toBe('');
  });

  it('分享视图没有顶部提示条，反馈也落在结果区自己的状态区', async () => {
    await boot(encodeSharePayload(input));
    await vi.waitFor(() => expect(document.querySelector('#result-panel')).not.toBeNull());
    stubClipboard(vi.fn().mockResolvedValue(undefined));

    const markdown = buttonOf('markdown-button');
    markdown.click();

    await vi.waitFor(() => expect(document.getElementById('action-status')!.textContent).toBe('Markdown 已复制'));
    expect(markdown.textContent).toBe('已复制 Markdown');
    expect(document.querySelector('#alert')).toBeNull();
  });

  it('就地反馈两秒后复位成原始文案', async () => {
    vi.useFakeTimers();
    try {
      await boot();
      await vi.advanceTimersByTimeAsync(0);
      expect(document.querySelector('#result-panel')).not.toBeNull();
      stubClipboard(vi.fn().mockResolvedValue(undefined));
      const markdown = buttonOf('markdown-button');

      markdown.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(markdown.textContent).toBe('已复制 Markdown');

      await vi.advanceTimersByTimeAsync(1999);
      expect(markdown.textContent).toBe('已复制 Markdown');

      await vi.advanceTimersByTimeAsync(1);
      expect(markdown.textContent).toBe('复制 Markdown');
      expect(markdown.classList.contains('done')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('旧分享链接缺账户余额时按 0 计入，页面与 Markdown 里都不出现 NaN', async () => {
    // 载荷里没有 accountBalance，等同早于余额字段的旧链接。
    await boot(encodeSharePayload(input));
    await vi.waitFor(() => expect(document.querySelector('#result-panel')).not.toBeNull());

    expect(document.querySelector('#result-panel')!.textContent).toContain('¥0.00（0.00 USD）');
    expect(document.body.textContent).not.toContain('NaN');
    expect((document.getElementById('markdown-output') as HTMLTextAreaElement).value).not.toContain('NaN');
  });
});
