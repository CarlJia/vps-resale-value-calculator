import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../../src/domain/calculator';
import type { CalculatorInput, ExchangeRateSnapshot } from '../../src/domain/types';
import { buildMarkdown, downloadQuoteImage } from '../../src/services/export';

const input = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '测试商家', productName: '东京套餐', highlight: '高性能', cpu: '2 核', memory: '4GB', storage: '80GB', bandwidth: '1Gbps', traffic: '2TB', location: '日本东京',
} satisfies CalculatorInput;

const rates: ExchangeRateSnapshot = { renewalToCny: 7, pushToCny: 7, fetchedAt: '2026-10-17T00:00:00.000Z' };
const rateTime = '2026-10-17T00:00:00.000Z';

describe('导出', () => {
  it('Markdown 报价明细输出账户余额行，标注人民币与原币金额', () => {
    // 续费率 7、余额 10 USD → 折算 ¥70.00，原币 10.00 USD。
    const withBalance: CalculatorInput = { ...input, accountBalance: 10 };
    const markdown = buildMarkdown(withBalance, calculateQuote(withBalance, rates), rateTime);

    expect(markdown).toContain('| 账户余额 | ¥70.00（10.00 USD） |');
    // 位置固定在「计入总价的手续费」之后、「买家总支付」之前。
    const lines = markdown.split('\n');
    const balanceIndex = lines.findIndex((line) => line.startsWith('| 账户余额 |'));
    const includedIndex = lines.findIndex((line) => line.startsWith('| 计入总价的手续费 |'));
    const buyerIndex = lines.findIndex((line) => line.startsWith('| **买家总支付** |'));
    expect(balanceIndex).toBeGreaterThan(includedIndex);
    expect(balanceIndex).toBeLessThan(buyerIndex);
  });

  it('余额为 0 时仍输出账户余额行，且格式与相邻明细行一致', () => {
    const quote = calculateQuote({ ...input, accountBalance: 0 }, rates);
    const markdown = buildMarkdown(input, quote, rateTime);

    expect(markdown).toContain('| 账户余额 | ¥0.00（0.00 USD） |');
    // 与其它明细行同样是「| 标签 | 值 |」的单元格。
    expect(markdown).toMatch(/^\| 账户余额 \| ¥\d+\.\d{2}（\d+\.\d{2} [A-Z]{3}） \|$/m);
  });

  it('买家总支付在 Markdown 顶部以醒目摘要呈现，并在明细表里整行加粗', () => {
    const quote = calculateQuote({ ...input, accountBalance: 10 }, rates);
    const markdown = buildMarkdown(input, quote, rateTime);

    // 顶部摘要：「## 标题之后，紧接着看到买家总支付」，让接受方第一眼就能读到金额。
    expect(markdown).toMatch(/^## VPS 转售报价\n\n> ### 💰 买家总支付：\*\*¥\d+\.\d{2}\*\*$/m);
    // 顶部摘要里也提示「卖家到手价与买家总支付相等」，避免把双方金额当成两笔。
    expect(markdown).toContain('卖家到手价同为 **¥');
    // 明细表里的「买家总支付」整行加粗（标签与值两侧都有 **）。
    expect(markdown).toContain('| **买家总支付** | **¥');
  });

  it('缺少 2D 上下文时图片导出抛出中文错误', async () => {
    // jsdom 未实现 canvas，getContext('2d') 返回 null，走既有失败分支而不触及下载路径。
    const quote = calculateQuote(input, rates);
    await expect(downloadQuoteImage(input, quote, rateTime)).rejects.toThrow('当前浏览器不支持图片导出');
  });
});
