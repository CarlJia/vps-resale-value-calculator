import { describe, expect, it } from 'vitest';
import { decodeSharePayload, encodeSharePayload } from '../../src/services/share-codec';
import { calculateQuote } from '../../src/domain/calculator';
import { validateInput } from '../../src/domain/validation';
import type { CalculatorInput, ExchangeRateSnapshot } from '../../src/domain/types';

const input = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '测试商家', productName: '东京套餐', highlight: '高性能', cpu: '2 核', memory: '4GB', storage: '80GB', bandwidth: '1Gbps', traffic: '2TB', location: '日本东京',
} satisfies CalculatorInput;

const rates: ExchangeRateSnapshot = { renewalToCny: 7, pushToCny: 7.2, fetchedAt: '2026-10-17T00:00:00.000Z' };

describe('分享编码', () => {
  it('支持中文输入的 UTF-8 Base64URL 往返', () => {
    const hash = encodeSharePayload(input);
    expect(hash).toMatch(/^#q=[A-Za-z0-9_-]+$/);
    expect(decodeSharePayload(hash)?.input).toEqual(input);
  });

  it('拒绝非法版本、损坏载荷和过长片段', () => {
    expect(decodeSharePayload('#q=bad')).toBeNull();
    expect(decodeSharePayload(`#q=${'a'.repeat(12001)}`)).toBeNull();
    expect(decodeSharePayload('')).toBeNull();
  });

  it('非零 accountBalance 随载荷往返保持一致', () => {
    const decoded = decodeSharePayload(encodeSharePayload({ ...input, accountBalance: 42.5 }));
    expect(decoded?.input.accountBalance).toBe(42.5);
  });

  it('缺少 accountBalance 的旧链接仍可解码，余额按 0 计且不产生 NaN', () => {
    // 模拟 U5 之前发出的分享链接：载荷里根本没有 accountBalance 这个键。
    const { accountBalance: _dropped, ...legacy } = { ...input, accountBalance: 30 };
    const decoded = decodeSharePayload(encodeSharePayload(legacy));
    expect(decoded).not.toBeNull();

    const quote = calculateQuote(decoded!.input, rates);
    expect(quote.balanceCny).toBe(0);
    expect(Number.isNaN(quote.balanceCny)).toBe(false);
    expect(Number.isNaN(quote.totalPrice)).toBe(false);
  });

  it('accountBalance 为非数字时不会进入计算（解码只校验结构，数值由输入校验拦截）', () => {
    const decoded = decodeSharePayload(encodeSharePayload({ ...input, accountBalance: 'x' as unknown as number }));
    // 如实记录现状：share-codec 只做结构校验，不做类型校验，所以这一步并不会返回 null。
    expect(decoded).not.toBeNull();
    // 现有规则下的实际拒绝点：非法数值由 validateInput 判为无效，calculateQuote 直接抛错，不会算出 NaN。
    expect(validateInput(decoded!.input).valid).toBe(false);
    expect(() => calculateQuote(decoded!.input, rates)).toThrow();
  });
});
