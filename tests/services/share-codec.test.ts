import { describe, expect, it } from 'vitest';
import { decodeSharePayload, encodeSharePayload } from '../../src/services/share-codec';
import type { CalculatorInput } from '../../src/domain/types';

const input = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '测试商家', productName: '东京套餐', highlight: '高性能', cpu: '2 核', memory: '4GB', storage: '80GB', bandwidth: '1Gbps', traffic: '2TB', location: '日本东京',
} satisfies CalculatorInput;

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
});
