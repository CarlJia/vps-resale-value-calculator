import { describe, expect, it } from 'vitest';
import { CURRENCY_CODES, normalizeCurrencyCode } from '../../src/domain/currencies';

describe('币种清单', () => {
  it('是一份无重复的 3 位大写代码名单，数量作为有意钉住的常量', () => {
    expect(CURRENCY_CODES).toHaveLength(158);
    expect(new Set(CURRENCY_CODES).size).toBe(158);
    expect(CURRENCY_CODES.every((code) => /^[A-Z]{3}$/.test(code))).toBe(true);
    expect([...CURRENCY_CODES]).toEqual([...CURRENCY_CODES].sort());
  });

  it('含 CNY 与 TWD 这类非 ECB 币种', () => {
    expect(CURRENCY_CODES).toContain('CNY');
    expect(CURRENCY_CODES).toContain('TWD');
  });

  it('剔除贵金属与记账单位', () => {
    for (const code of ['XAU', 'XAG', 'XPT', 'XPD', 'XDR', 'CNH', 'CMD']) {
      expect(CURRENCY_CODES).not.toContain(code);
    }
  });
});

describe('币种代码归一化', () => {
  it('小写与带空格的输入归一为 3 位大写代码', () => {
    expect(normalizeCurrencyCode(' usd ')).toBe('USD');
    expect(normalizeCurrencyCode('twd')).toBe('TWD');
  });

  it('非法形态被拒绝', () => {
    for (const value of ['', '  ', 'US', 'USDD', 'U1D', '美元']) {
      expect(normalizeCurrencyCode(value)).toBeNull();
    }
  });
});
