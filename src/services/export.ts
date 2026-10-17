import { formatCny, formatCnyWithOriginal } from '../domain/money';
import type { CalculatorInput, QuoteResult } from '../domain/types';

export function buildMarkdown(input: CalculatorInput, quote: QuoteResult, rateTime: string): string {
  const config = [
    ['商家', input.provider], ['产品', input.productName], ['特色', input.highlight], ['CPU', input.cpu], ['内存', input.memory],
    ['存储', input.storage ? `${input.storage} ${input.storageUnit ?? 'GB'}` : ''], ['带宽', input.bandwidth ? `${input.bandwidth} ${input.bandwidthUnit ?? 'Mbps'}` : ''], ['流量', input.traffic ? `${input.traffic} ${input.trafficUnit ?? 'TB'}（${input.trafficDirection === 'single' ? '单向' : '双向'}，${input.trafficResetCycle === 'yearly' ? '每年重置' : input.trafficResetCycle === 'none' ? '不重置' : '每月重置'}）` : ''], ['位置', input.location],
  ].filter(([, value]) => value);
  // 顶部先抛一个醒目的买家总价，再切到明细：接收方先看到「该付多少」，再回头理解构成。
  const lines: string[] = [
    '## VPS 转售报价',
    '',
    `> ### 💰 买家总支付：**${formatCny(quote.buyerTotal)}**`,
    '>',
    `> 卖家到手价同为 **${formatCny(quote.sellerNet)}**（双方金额相等 · 剩余价值 + 手动溢价 + 计入总价的手续费 + 账户余额）。`,
    '',
  ];
  // 三张表格对应原来的三个块：信息 / 价值 / 明细。表头写在数据之前，方便阅读器渲染对齐。
  const tableDivider = '| --- | --- |';
  if (config.length) {
    lines.push('### VPS 信息', '', '| 项目 | 内容 |', tableDivider);
    for (const [label, value] of config) lines.push(`| ${label} | ${value} |`);
    lines.push('');
  }
  lines.push(
    '### 价值信息', '', '| 项目 | 数值 |', tableDivider,
    `| 交易日期 | ${input.tradeDate} |`,
    `| 到期日期 | ${input.expiryDate} |`,
    `| 剩余天数 | ${quote.remainingDays} 天 |`,
    `| 理论剩余价值 | ${formatCny(quote.theoreticalValue)} |`,
    `| 折损率 | ${quote.discountRate.toFixed(1)}% |`,
    `| 折损后建议价 | ${formatCny(quote.adjustedValue)} |`,
    '',
    '### 报价明细', '', '| 项目 | 金额 |', tableDivider,
    `| 剩余价值 | ${formatCny(quote.baseSalePrice)} |`,
    `| 手动溢价 | ${formatCny(quote.premiumAmount)} |`,
    `| Push 手续费 | ${formatCny(quote.pushFeeCny)} |`,
    `| 卖家承担比例 | ${quote.sellerFeeRate.toFixed(1)}% |`,
    `| 计入总价的手续费 | ${formatCny(quote.includedPushFee)} |`,
    `| 账户余额 | ${formatCnyWithOriginal(quote.balanceCny, quote.balanceAmount, quote.balanceCurrency)} |`,
    // 明细里再把买家总价整行加粗，与顶部摘要呼应，避免只有顶部一眼看不到的「¥xx」。
    `| **买家总支付** | **${formatCny(quote.buyerTotal)}** |`,
    `| 卖家到手价 | ${formatCny(quote.sellerNet)} |`,
    `| 溢价 | ${quote.premium >= 0 ? '+' : ''}${formatCny(quote.premium)}（${quote.premiumRate.toFixed(1)}%）|`,
    '',
    `> 汇率更新时间：${new Date(rateTime).toLocaleString('zh-CN')}`,
  );
  return lines.join('\n');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadQuoteImage(input: CalculatorInput, quote: QuoteResult, rateTime: string): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1100;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持图片导出');
  context.fillStyle = '#f4f7fa';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#172435'; context.fillRect(48, 48, 1104, 220);
  context.fillStyle = '#d6e97d'; context.font = '700 24px sans-serif'; context.fillText('VPS RESALE RESULT', 86, 96);
  context.fillStyle = '#fff'; context.font = '700 42px sans-serif'; context.fillText(input.productName || 'VPS 转售报价', 86, 150);
  context.font = '22px sans-serif'; context.fillStyle = '#b7c3cf'; context.fillText([input.provider, input.location].filter(Boolean).join(' · ') || '单台 VPS', 86, 194);
  context.fillStyle = '#172435'; context.fillRect(48, 294, 1104, 150);
  context.fillStyle = '#7d8c9a'; context.font = '20px sans-serif'; context.fillText('买家总支付 / 卖家到手价', 86, 334);
  context.fillStyle = '#fff'; context.font = '700 54px sans-serif'; context.fillText(formatCny(quote.totalPrice), 86, 408);
  const valueRows: Array<[string, string]> = [['理论剩余价值', formatCny(quote.theoreticalValue)], ['折损后建议价', formatCny(quote.adjustedValue)], ['剩余周期', `${quote.remainingDays} 天`]];
  const feeRows: Array<[string, string]> = [['手动溢价', formatCny(quote.premiumAmount)], ['Push 手续费', formatCny(quote.pushFeeCny)], ['计入总价手续费', formatCny(quote.includedPushFee)], ['账户余额', formatCnyWithOriginal(quote.balanceCny, quote.balanceAmount, quote.balanceCurrency)]];
  const drawTable = (title: string, rows: Array<[string, string]>, top: number): number => {
    const rowHeight = 58;
    const tableHeight = 48 + rows.length * rowHeight;
    context.fillStyle = '#ffffff'; context.fillRect(72, top, 1056, tableHeight);
    context.strokeStyle = '#cbd5df'; context.lineWidth = 2; context.strokeRect(72, top, 1056, tableHeight);
    context.fillStyle = '#e9eef3'; context.fillRect(73, top + 1, 1054, 46);
    context.fillStyle = '#172435'; context.font = '700 22px sans-serif'; context.fillText(title, 92, top + 31);
    rows.forEach(([label, value], index) => {
      const rowTop = top + 48 + index * rowHeight;
      context.strokeStyle = '#d9e1e8'; context.lineWidth = 1; context.beginPath(); context.moveTo(72, rowTop); context.lineTo(1128, rowTop); context.stroke();
      context.fillStyle = '#64748b'; context.font = '21px sans-serif'; context.fillText(label, 92, rowTop + 36);
      context.fillStyle = '#172435'; context.font = '700 22px sans-serif'; context.fillText(value, 760, rowTop + 36);
    });
    context.beginPath(); context.moveTo(700, top + 48); context.lineTo(700, top + tableHeight); context.stroke();
    return top + tableHeight;
  };
  const valueBottom = drawTable('价值分析', valueRows, 478);
  // 费用表加「账户余额」一行后：顶边 724 + 表头 48 + 4×58 = 底边 1004（比原来低 58px）。
  // 页脚改为贴着费用表底边下移 34px（原写死 1014 会压到表格上），基线 1038，18px 字形下缘约 1042，
  // 距画布下沿 1100 仍有 58px，既不重叠也不越界。
  const feeBottom = drawTable('费用明细', feeRows, valueBottom + 24);
  context.fillStyle = '#64748b'; context.font = '18px sans-serif'; context.fillText(`交易日 ${input.tradeDate} · 到期日 ${input.expiryDate} · 汇率更新 ${new Date(rateTime).toLocaleString('zh-CN')}`, 72, feeBottom + 34);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片生成失败');
  downloadBlob(blob, `vps报价-${Date.now()}.png`);
}
