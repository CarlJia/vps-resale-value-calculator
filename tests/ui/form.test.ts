import { beforeEach, describe, expect, it } from 'vitest';
import { calculateQuote } from '../../src/domain/calculator';
import type { CalculatorInput } from '../../src/domain/types';
import { validateInput } from '../../src/domain/validation';
import { bindCurrencyComboboxes } from '../../src/ui/combobox';
import { fillForm, readForm, renderForm } from '../../src/ui/form';

const input: CalculatorInput = {
  renewalAmount: 10, renewalCurrency: 'USD', paymentCycleMonths: 12, tradeDate: '2026-01-01', expiryDate: '2027-01-01',
  salePrice: 100, premiumAmount: 0, discountRate: 10, pushFeeAmount: 5, pushFeeCurrency: 'USD', feeMode: 'split', sellerFeeRate: 50,
  provider: '', productName: '', highlight: '', cpu: '', memory: '', memoryUnit: 'GB', storage: '', storageUnit: 'GB',
  bandwidth: '', bandwidthUnit: 'Mbps', traffic: '', trafficUnit: 'TB', trafficResetCycle: 'monthly', trafficDirection: 'double', location: '',
};

const triggerOf = (id: string) => document.getElementById(id) as HTMLInputElement;
const searchOf = (id: string) => document.getElementById(`${id}-search`) as HTMLInputElement;

function mountForm(): HTMLFormElement {
  document.body.innerHTML = renderForm();
  bindCurrencyComboboxes(document);
  fillForm(input);
  return document.querySelector<HTMLFormElement>('#calculator-form')!;
}

const selectCurrency = (id: string, query: string) => {
  triggerOf(id).click();
  const search = searchOf(id);
  search.value = query;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('表单里的两个币种字段', () => {
  it('都是下拉而不是自由文本输入框', () => {
    const form = mountForm();

    expect(form.querySelectorAll('[data-combobox]')).toHaveLength(2);
    for (const id of ['renewal-currency', 'push-fee-currency']) {
      expect(triggerOf(id).hasAttribute('readonly')).toBe(true);
      expect(triggerOf(id).getAttribute('aria-haspopup')).toBe('listbox');
    }
    expect(renderForm()).not.toContain('maxlength="3"');
  });

  it('读到的币种始终是 3 位大写代码，弹层里的筛选文本不参与读取', () => {
    mountForm();
    expect(readForm().renewalCurrency).toBe('USD');

    triggerOf('renewal-currency').click();
    const search = searchOf('renewal-currency');
    search.value = 'eur';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(readForm().renewalCurrency).toBe('USD');
    expect(triggerOf('renewal-currency').value).toBe('USD');

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(readForm().renewalCurrency).toBe('EUR');
    expect(readForm().renewalCurrency).toMatch(/^[A-Z]{3}$/);
  });

  it('下拉提交后读到的代码与表单校验一致', () => {
    mountForm();
    selectCurrency('push-fee-currency', 'twd');

    const read = readForm();
    expect(read.pushFeeCurrency).toBe('TWD');
    expect(validateInput(read).valid).toBe(true);
  });

  it('读表单时把币种归一为 3 位大写代码，非法形态交给校验层拒绝', () => {
    mountForm();

    triggerOf('renewal-currency').value = ' twd ';
    expect(readForm().renewalCurrency).toBe('TWD');

    triggerOf('renewal-currency').value = 'US';
    const read = readForm();
    expect(read.renewalCurrency).toBe('');
    expect(validateInput(read).errors).toContain('货币必须使用 3 位大写代码');
  });

  it('fillForm 写回币种后，下拉的已选代码与可读名称一起同步', () => {
    mountForm();
    fillForm({ ...input, renewalCurrency: 'TWD' });

    expect(triggerOf('renewal-currency').value).toBe('TWD');
    expect(triggerOf('renewal-currency').getAttribute('aria-label')).toContain('TWD');
    expect(readForm().renewalCurrency).toBe('TWD');
  });
});

describe('账户余额的读取方向', () => {
  const rates = { renewalToCny: 7, pushToCny: 7, fetchedAt: '2026-10-17T00:00:00.000Z' };

  it('表单里填的余额被读进输入，并折算进双方总金额', () => {
    mountForm();
    const balance = document.getElementById('account-balance') as HTMLInputElement;
    expect(readForm().accountBalance).toBe(0);

    balance.value = '12.5';
    const read = readForm();
    expect(read.accountBalance).toBe(12.5);

    const quote = calculateQuote(read, rates);
    expect(quote.balanceCny).toBeCloseTo(87.5);
    expect(quote.balanceAmount).toBe(12.5);
    expect(quote.balanceCurrency).toBe('USD');
    expect(quote.totalPrice).toBeCloseTo(205);
    expect(quote.buyerTotal).toBe(quote.totalPrice);
    expect(quote.sellerNet).toBe(quote.totalPrice);

    // 余额只进总金额、不进溢价：清零后溢价不变。
    expect(calculateQuote({ ...read, accountBalance: 0 }, rates).premium).toBeCloseTo(quote.premium);
  });
});
