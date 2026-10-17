import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENCY_CODES } from '../../src/domain/currencies';
import { currencyLabel } from '../../src/ui/currency-label';
import { bindCurrencyComboboxes, renderCurrencyCombobox } from '../../src/ui/combobox';

const options = CURRENCY_CODES.map((code) => ({ code, label: currencyLabel(code) }));

const LABELS: Record<string, string> = { 'renewal-currency': '续费币种', 'push-fee-currency': '手续费币种' };

function mount(ids: string[] = ['renewal-currency']) {
  document.body.innerHTML = `<form id="f">${ids
    .map((id) => renderCurrencyCombobox({ id, label: LABELS[id], value: 'USD', options }))
    .join('')}</form>`;
  bindCurrencyComboboxes(document);
  const form = document.querySelector<HTMLFormElement>('#f')!;
  const onChange = vi.fn();
  form.addEventListener('change', onChange);
  return { onChange };
}

const triggerOf = (id: string) => document.getElementById(id) as HTMLInputElement;
const searchOf = (id: string) => document.getElementById(`${id}-search`) as HTMLInputElement;
const popupOf = (id: string) => document.getElementById(`${id}-popup`) as HTMLElement;
const isOpen = (id: string) => !popupOf(id).classList.contains('hidden');
const codesOf = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`#${id}-listbox [role="option"]`))
  .filter((item) => !item.classList.contains('hidden'))
  .map((item) => item.dataset.code);
const activeOf = (id: string) => document.querySelector<HTMLElement>(`#${id}-listbox [aria-selected="true"]`);
const emptyHintOf = (id: string) => document.getElementById(`${id}-popup`)!.querySelector('.combobox-empty') as HTMLElement;

const type = (id: string, value: string) => {
  const search = searchOf(id);
  search.value = value;
  search.dispatchEvent(new Event('input', { bubbles: true }));
};
const press = (id: string, key: string) => searchOf(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const pressTrigger = (id: string, key: string) => triggerOf(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const commits = (id: string) => { press(id, 'ArrowDown'); press(id, 'Enter'); };

beforeEach(() => { document.body.innerHTML = ''; });

describe('币种下拉组件', () => {
  it('点击展开后搜索框获得焦点，代码前缀与中文名片段都能筛出币种', () => {
    mount();
    triggerOf('renewal-currency').click();

    expect(isOpen('renewal-currency')).toBe(true);
    expect(document.activeElement).toBe(searchOf('renewal-currency'));
    expect(codesOf('renewal-currency')).toHaveLength(CURRENCY_CODES.length);

    type('renewal-currency', 'tw');
    expect(codesOf('renewal-currency')).toEqual(['TWD']);

    type('renewal-currency', '新台');
    expect(codesOf('renewal-currency')).toEqual(['TWD']);

    type('renewal-currency', '不存在的币种');
    expect(codesOf('renewal-currency')).toEqual([]);
    expect(emptyHintOf('renewal-currency').classList.contains('hidden')).toBe(false);

    type('renewal-currency', 'TWD');
    expect(emptyHintOf('renewal-currency').classList.contains('hidden')).toBe(true);
    expect(activeOf('renewal-currency')).toBeNull();
  });

  it('键盘展开、方向键移动高亮且两端都不越界', () => {
    mount();
    pressTrigger('renewal-currency', 'ArrowDown');
    expect(isOpen('renewal-currency')).toBe(true);
    expect(document.activeElement).toBe(searchOf('renewal-currency'));

    press('renewal-currency', 'ArrowUp');
    expect(activeOf('renewal-currency')?.dataset.code).toBe('ZWG');

    press('renewal-currency', 'ArrowUp');
    press('renewal-currency', 'ArrowDown');
    expect(activeOf('renewal-currency')?.dataset.code).toBe('ZWG');

    pressTrigger('renewal-currency', 'Enter');
    expect(isOpen('renewal-currency')).toBe(true);
  });

  it('回车提交高亮的候选后写回 3 位大写代码并派发一次 change', () => {
    const { onChange } = mount();
    triggerOf('renewal-currency').click();
    type('renewal-currency', 'tw');
    expect(activeOf('renewal-currency')).toBeNull();

    commits('renewal-currency');

    expect(triggerOf('renewal-currency').value).toBe('TWD');
    expect(isOpen('renewal-currency')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(triggerOf('renewal-currency'));
  });

  it('无匹配时回车不改变币种也不派发 change', () => {
    const { onChange } = mount();
    triggerOf('renewal-currency').click();
    type('renewal-currency', '不存在的币种');

    press('renewal-currency', 'Enter');

    expect(triggerOf('renewal-currency').value).toBe('USD');
    expect(onChange).not.toHaveBeenCalled();
    expect(isOpen('renewal-currency')).toBe(true);
  });

  it('Esc、组件外部鼠标事件与失焦都关闭、保持原币种且不派发 change', () => {
    const { onChange } = mount();
    const trigger = triggerOf('renewal-currency');

    trigger.click();
    type('renewal-currency', 'eur');
    press('renewal-currency', 'Escape');
    expect(isOpen('renewal-currency')).toBe(false);
    expect(searchOf('renewal-currency').value).toBe('');
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(isOpen('renewal-currency')).toBe(false);

    trigger.click();
    searchOf('renewal-currency').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(isOpen('renewal-currency')).toBe(false);

    expect(trigger.value).toBe('USD');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Tab 关闭弹层但不抢走焦点', () => {
    mount();
    triggerOf('renewal-currency').click();
    press('renewal-currency', 'Tab');

    expect(isOpen('renewal-currency')).toBe(false);
    expect(document.activeElement).toBe(searchOf('renewal-currency'));
  });

  it('选项走 mousedown 提交、click 不提交，且筛选不改动货币输入框的值', () => {
    const { onChange } = mount();
    triggerOf('renewal-currency').click();
    type('renewal-currency', 'eur');
    expect(triggerOf('renewal-currency').value).toBe('USD');

    const option = document.getElementById('renewal-currency-option-EUR') as HTMLElement;
    option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(triggerOf('renewal-currency').value).toBe('USD');
    expect(onChange).not.toHaveBeenCalled();

    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(triggerOf('renewal-currency').value).toBe('EUR');
    expect(isOpen('renewal-currency')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('弹层与选项都不在 label 内部，弹层是标签的兄弟节点', () => {
    mount();
    const trigger = triggerOf('renewal-currency');
    const label = document.querySelector<HTMLLabelElement>('.field-label')!;
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('renewal-currency');
    expect(trigger.closest('label')).toBeNull();
    expect(searchOf('renewal-currency').closest('label')).toBeNull();
    expect(document.getElementById('renewal-currency-listbox')!.closest('label')).toBeNull();
    expect(label.nextElementSibling).toBe(trigger);
    expect(popupOf('renewal-currency').previousElementSibling).toBe(trigger);
  });

  it('语义归属钉在具体元素上：搜索框承载 combobox 角色，触发框带 aria-haspopup', () => {
    mount();
    const trigger = triggerOf('renewal-currency');
    const search = searchOf('renewal-currency');

    expect(search.getAttribute('role')).toBe('combobox');
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(search.getAttribute('aria-controls')).toBe('renewal-currency-listbox');
    expect(search.getAttribute('aria-activedescendant')).toBeNull();
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-label')).toContain('USD');

    trigger.click();
    type('renewal-currency', 'tw');
    press('renewal-currency', 'ArrowDown');

    expect(search.getAttribute('aria-expanded')).toBe('true');
    expect(activeOf('renewal-currency')?.getAttribute('aria-selected')).toBe('true');
    expect(search.getAttribute('aria-activedescendant')).toBe(activeOf('renewal-currency')?.id);

    commits('renewal-currency');
    expect(search.getAttribute('aria-activedescendant')).toBeNull();
    expect(trigger.getAttribute('aria-label')).toContain('TWD');
  });

  it('输入法组合期既不筛选也不提交，组合结束后恢复', () => {
    const { onChange } = mount();
    triggerOf('renewal-currency').click();
    const search = searchOf('renewal-currency');

    search.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    search.value = 'tw';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(codesOf('renewal-currency')).toHaveLength(CURRENCY_CODES.length);

    press('renewal-currency', 'ArrowDown');
    press('renewal-currency', 'Enter');
    expect(triggerOf('renewal-currency').value).toBe('USD');
    expect(onChange).not.toHaveBeenCalled();
    expect(isOpen('renewal-currency')).toBe(true);

    search.dispatchEvent(new Event('compositionend', { bubbles: true }));
    expect(codesOf('renewal-currency')).toEqual(['TWD']);

    commits('renewal-currency');
    expect(triggerOf('renewal-currency').value).toBe('TWD');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('两个实例各自开合、各自筛选与提交，互不影响', () => {
    const { onChange } = mount(['renewal-currency', 'push-fee-currency']);

    triggerOf('renewal-currency').click();
    type('renewal-currency', 'tw');
    expect(codesOf('renewal-currency')).toEqual(['TWD']);
    expect(activeOf('renewal-currency')).toBeNull();

    triggerOf('push-fee-currency').click();
    expect(isOpen('push-fee-currency')).toBe(true);
    expect(isOpen('renewal-currency')).toBe(false);

    type('push-fee-currency', 'eur');
    press('push-fee-currency', 'ArrowDown');
    expect(codesOf('push-fee-currency')).toEqual(['EUR']);
    expect(activeOf('push-fee-currency')?.dataset.code).toBe('EUR');
    expect(codesOf('renewal-currency')).toEqual(['TWD']);
    expect(activeOf('renewal-currency')).toBeNull();

    commits('push-fee-currency');
    expect(triggerOf('push-fee-currency').value).toBe('EUR');
    expect(triggerOf('renewal-currency').value).toBe('USD');
    expect(onChange).toHaveBeenCalledTimes(1);

    triggerOf('renewal-currency').click();
    type('renewal-currency', 'tw');
    commits('renewal-currency');
    expect(triggerOf('renewal-currency').value).toBe('TWD');
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
