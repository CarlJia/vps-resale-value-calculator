/**
 * 币种中文名：交给运行环境生成，不手写 158 个名字（KTD4）。
 * 运行环境没有完整 ICU 时 `Intl.DisplayNames` 可能缺失、抛错、或原样返回代码，三种情况都退回代码。
 */
let displayNames: Intl.DisplayNames | null | undefined;

function getDisplayNames(): Intl.DisplayNames | null {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['zh-CN'], { type: 'currency' });
    } catch {
      displayNames = null;
    }
  }
  return displayNames;
}

export function currencyLabel(code: string): string {
  const names = getDisplayNames();
  if (!names) return code;
  try {
    const label = names.of(code);
    return label && label !== code ? label : code;
  } catch {
    return code;
  }
}
