import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../../src/domain/calculator';
import type { CalculatorInput, ExchangeRateSnapshot } from '../../src/domain/types';
import { renderResult } from '../../src/ui/result';

const input: CalculatorInput = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '', productName: '', highlight: '', cpu: '', memory: '', storage: '', bandwidth: '', traffic: '', location: '',
};
const rates: ExchangeRateSnapshot = { renewalToCny: 7, pushToCny: 7, fetchedAt: '2026-01-01T00:00:00Z' };

const render = (accountBalance: number) => {
  const withBalance = { ...input, accountBalance };
  return renderResult(withBalance, calculateQuote(withBalance, rates), rates.fetchedAt);
};

describe('结果区的账户余额行', () => {
  it('同时给出折算后的人民币金额、原币金额与币种', () => {
    const html = render(10);

    expect(html).toContain('<span>账户余额</span><b>¥70.00（10.00 USD）</b>');
  });

  it('余额为 0 时仍按明细行的样式渲染', () => {
    expect(render(0)).toContain('<span>账户余额</span><b>¥0.00（0.00 USD）</b>');
  });

  it('主数字下方的说明写清余额与手动溢价都计入双方金额', () => {
    expect(render(10)).toContain('双方金额相等 · 剩余价值 + 手动溢价 + 计入总价的手续费 + 账户余额');
  });

  it('币种取自续费币种', () => {
    const withBalance = { ...input, renewalCurrency: 'TWD', accountBalance: 100 };
    const html = renderResult(withBalance, calculateQuote(withBalance, { ...rates, renewalToCny: 0.22 }), rates.fetchedAt);

    expect(html).toContain('<span>账户余额</span><b>¥22.00（100.00 TWD）</b>');
  });

  it('分享链接里的自由文本按纯文本渲染，不会变成可执行的标记', () => {
    const hostile = {
      ...input,
      productName: '<img src=x onerror="alert(1)">',
      provider: '</p><script>alert(2)</script>',
      location: '东京',
      cpu: '<b>注入</b>',
    };
    const html = renderResult(hostile, calculateQuote(hostile, rates), rates.fetchedAt);
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('.config-list b')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(host.textContent).toContain('<b>注入</b>');
    expect(host.textContent).toContain('东京');
  });
});
