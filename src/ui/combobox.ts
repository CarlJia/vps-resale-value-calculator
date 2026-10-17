export interface CurrencyComboboxOption { code: string; label: string }

export interface CurrencyComboboxConfig {
  id: string;
  label: string;
  value: string;
  options: readonly CurrencyComboboxOption[];
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);

/**
 * 渲染一个币种下拉字段，返回整个 `.field` 块：标签、只读触发输入框与弹层容器。
 *
 * 触发输入框的 id 由调用方给定（表单里是 `#renewal-currency` / `#push-fee-currency`），
 * 它的 `.value` 就是币种的唯一真值；弹层是标签的兄弟节点，搜索框与选项都不在 `<label>` 内。
 */
export function renderCurrencyCombobox({ id, label, value, options }: CurrencyComboboxConfig): string {
  const listId = `${id}-listbox`;
  return `<div class="field combobox-field" data-combobox="${id}">
      <label class="field-label" for="${id}"><span>${escapeHtml(label)}</span></label>
      <input id="${id}" class="combobox-trigger" type="text" value="${escapeHtml(value)}" readonly required aria-haspopup="listbox" aria-label="${escapeHtml(`${label}，已选 ${value}`)}" autocomplete="off">
      <div class="combobox-popup hidden" id="${id}-popup">
        <input id="${id}-search" class="combobox-search" type="text" role="combobox" aria-expanded="false" aria-controls="${listId}" aria-label="搜索币种" placeholder="输入代码或中文名" autocomplete="off">
        <ul class="combobox-listbox" id="${listId}" role="listbox" aria-label="${escapeHtml(label)}">
          ${options.map((option) => `<li class="combobox-option" id="${id}-option-${option.code}" role="option" aria-selected="false" data-code="${option.code}" data-label="${escapeHtml(option.label)}">${option.code}<i>${escapeHtml(option.label)}</i></li>`).join('')}
        </ul>
        <p class="combobox-empty hidden">没有匹配的币种</p>
      </div>
    </div>`;
}

/** 接线入口：把 root 下每个 `[data-combobox]` 接上开合、筛选、高亮与提交。 */
export function bindCurrencyComboboxes(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-combobox]').forEach((container) => bindCombobox(container));
}

/** 关闭 root 下所有弹层，供复位之类的表单级动作使用；不改动任何已提交币种。 */
export function closeCurrencyComboboxes(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-combobox]').forEach((container) => closeCombobox(container, false));
}

/** 程序化写回币种（fillForm 复位、分享链接还原）后，把触发框的可读名称同步成当前代码。 */
export function syncCurrencyComboboxLabels(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-combobox]').forEach((container) => syncTriggerLabel(container));
}

function syncTriggerLabel(container: HTMLElement): void {
  const trigger = container.querySelector<HTMLInputElement>('.combobox-trigger');
  if (!trigger) return;
  const labelText = container.querySelector('.field-label')?.textContent ?? '';
  trigger.setAttribute('aria-label', `${labelText}，已选 ${trigger.value}`);
}

function closeCombobox(container: HTMLElement, focusTrigger: boolean): void {
  const popup = container.querySelector<HTMLElement>('.combobox-popup');
  const search = container.querySelector<HTMLInputElement>('.combobox-search');
  if (!popup || !search) return;
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
  search.value = '';
  search.setAttribute('aria-expanded', 'false');
  search.removeAttribute('aria-activedescendant');
  container.querySelectorAll<HTMLElement>('[role="option"]').forEach((item) => item.setAttribute('aria-selected', 'false'));
  if (focusTrigger) container.querySelector<HTMLInputElement>('.combobox-trigger')?.focus();
}

function bindCombobox(container: HTMLElement): void {
  const trigger = container.querySelector<HTMLInputElement>('.combobox-trigger');
  const popup = container.querySelector<HTMLElement>('.combobox-popup');
  const search = container.querySelector<HTMLInputElement>('.combobox-search');
  const emptyHint = container.querySelector<HTMLElement>('.combobox-empty');
  if (!trigger || !popup || !search || !emptyHint) return;

  const items = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
  let composing = false;

  const isOpen = () => !popup.classList.contains('hidden');
  const visibleItems = () => items.filter((item) => !item.classList.contains('hidden'));
  const activeItem = () => items.find((item) => item.getAttribute('aria-selected') === 'true') ?? null;

  const setHighlight = (target: HTMLElement | null) => {
    items.forEach((item) => item.setAttribute('aria-selected', String(item === target)));
    if (target) {
      search.setAttribute('aria-activedescendant', target.id);
      if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
    } else {
      search.removeAttribute('aria-activedescendant');
    }
  };

  const applyFilter = (query: string) => {
    const text = query.trim();
    const upper = text.toUpperCase();
    let matched = 0;
    items.forEach((item) => {
      const hit = !text || (item.dataset.code ?? '').startsWith(upper) || (item.dataset.label ?? '').includes(text);
      item.classList.toggle('hidden', !hit);
      if (hit) matched += 1;
    });
    emptyHint.classList.toggle('hidden', matched > 0);
    setHighlight(null);
  };

  const open = () => {
    if (isOpen()) return;
    popup.classList.remove('hidden');
    search.setAttribute('aria-expanded', 'true');
    search.value = '';
    applyFilter('');
    search.focus();
  };

  const commit = (item: HTMLElement) => {
    const code = item.dataset.code;
    if (!code) return;
    trigger.value = code;
    syncTriggerLabel(container);
    closeCombobox(container, true);
    trigger.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const moveHighlight = (step: number) => {
    const list = visibleItems();
    if (!list.length) return;
    const current = activeItem();
    const index = current ? list.indexOf(current) : -1;
    if (index === -1) { setHighlight(list[step > 0 ? 0 : list.length - 1]); return; }
    setHighlight(list[Math.min(list.length - 1, Math.max(0, index + step))]);
  };

  trigger.addEventListener('click', open);
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });

  // 输入法组合期：确认候选字的回车必须留给输入法，否则会把当时高亮的币种写回字段。
  search.addEventListener('compositionstart', () => { composing = true; });
  search.addEventListener('compositionend', () => { composing = false; applyFilter(search.value); });
  search.addEventListener('input', () => { if (!composing) applyFilter(search.value); });
  search.addEventListener('keydown', (event) => {
    if (composing || event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = activeItem();
      if (item) commit(item);
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); closeCombobox(container, true); return; }
    if (event.key === 'Tab') closeCombobox(container, false);
  });

  container.querySelector('.combobox-listbox')?.addEventListener('mousedown', (event) => {
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="option"]');
    if (!item) return;
    event.preventDefault();
    commit(item);
  });

  container.addEventListener('focusout', (event) => {
    if (!isOpen()) return;
    const next = (event as FocusEvent).relatedTarget;
    if (next instanceof Node && container.contains(next)) return;
    closeCombobox(container, false);
  });

  document.addEventListener('mousedown', (event) => {
    if (!isOpen()) return;
    const target = event.target;
    if (target instanceof Node && container.contains(target)) return;
    closeCombobox(container, true);
  });
}
