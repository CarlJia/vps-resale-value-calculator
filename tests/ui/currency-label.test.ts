import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const stubDisplayNames = (impl: unknown) => {
  vi.stubGlobal('Intl', { DisplayNames: impl });
};

describe('币种中文名', () => {
  it('常见币种返回中文名', async () => {
    const { currencyLabel } = await import('../../src/ui/currency-label');
    expect(currencyLabel('USD')).toBe('美元');
    expect(currencyLabel('TWD')).toBe('新台币');
    expect(currencyLabel('JPY')).toBe('日元');
  });

  it('DisplayNames 不可用时退回币种代码', async () => {
    stubDisplayNames(class { constructor() { throw new Error('no icu'); } });
    const { currencyLabel } = await import('../../src/ui/currency-label');
    expect(currencyLabel('USD')).toBe('USD');
  });

  it('DisplayNames 原样返回代码时退回代码', async () => {
    stubDisplayNames(class { of(value: string) { return value; } });
    const { currencyLabel } = await import('../../src/ui/currency-label');
    expect(currencyLabel('USD')).toBe('USD');
  });

  it('DisplayNames 返回空值时退回代码', async () => {
    stubDisplayNames(class { of() { return ''; } });
    const { currencyLabel } = await import('../../src/ui/currency-label');
    expect(currencyLabel('USD')).toBe('USD');
  });

  it('DisplayNames 抛错时退回代码', async () => {
    stubDisplayNames(class { of() { throw new RangeError('invalid currency code'); } });
    const { currencyLabel } = await import('../../src/ui/currency-label');
    expect(currencyLabel('ZZZ')).toBe('ZZZ');
  });
});
