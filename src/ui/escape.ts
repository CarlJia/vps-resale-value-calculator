const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * 把非字面量文本安全地放进 HTML 模板字符串。
 *
 * 分享链接里的自由文本字段（商家、产品名、机房位置等）可以来自任何人，插值前必须过这里；
 * 币种代码与中文名也走同一处，避免每个渲染模块各写一份转义。
 */
export const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
