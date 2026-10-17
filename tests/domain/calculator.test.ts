import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../../src/domain/calculator';
import type { CalculatorInput, ExchangeRateSnapshot } from '../../src/domain/types';

const input: CalculatorInput = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '', productName: '', highlight: '', cpu: '', memory: '', storage: '', bandwidth: '', traffic: '', location: '',
};
const rates: ExchangeRateSnapshot = { renewalToCny: 7, pushToCny: 7, fetchedAt: '2026-01-01T00:00:00Z' };

describe('报价计算', () => {
  it('按剩余时间、折损率和手续费承担比例计算双方相等总价', () => {
    const result = calculateQuote(input, rates);
    expect(result.theoreticalValue).toBeCloseTo(70);
    expect(result.adjustedValue).toBeCloseTo(63);
    expect(result.includedPushFee).toBeCloseTo(17.5);
    expect(result.totalPrice).toBeCloseTo(117.5);
    expect(result.buyerTotal).toBe(result.sellerNet);
  });

  it('过期日期将剩余价值归零', () => {
    const result = calculateQuote({ ...input, expiryDate: '2025-12-31' }, rates);
    expect(result.remainingDays).toBe(0);
    expect(result.theoreticalValue).toBe(0);
    expect(result.adjustedValue).toBe(0);
  });

  it('买家、卖家和比例模式分别映射为 0%、100% 和自定义比例', () => {
    expect(calculateQuote({ ...input, feeMode: 'buyer' }, rates).totalPrice).toBeCloseTo(135);
    expect(calculateQuote({ ...input, feeMode: 'seller' }, rates).totalPrice).toBeCloseTo(100);
    expect(calculateQuote({ ...input, feeMode: 'split', sellerFeeRate: 50 }, rates).totalPrice).toBeCloseTo(117.5);
  });

  it('将手动溢价计入双方总价', () => {
    const result = calculateQuote({ ...input, premiumAmount: 20 }, rates);
    expect(result.totalPrice).toBeCloseTo(137.5);
    expect(result.buyerTotal).toBe(result.sellerNet);
  });

  it('拒绝非法日期和非有限付款周期', () => {
    expect(() => calculateQuote({ ...input, expiryDate: '2026-02-30' }, rates)).toThrow('有效的交易日期');
    expect(() => calculateQuote({ ...input, paymentCycleMonths: Number.NaN }, rates)).toThrow('付款周期');
  });
});
