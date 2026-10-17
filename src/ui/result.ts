import { formatCny, formatCnyWithOriginal } from '../domain/money';
import type { CalculatorInput, QuoteResult } from '../domain/types';

const feeModeLabel = (input: CalculatorInput) => input.feeMode === 'buyer' ? '买家承担' : input.feeMode === 'seller' ? '卖家承担' : `按比例承担（卖家 ${input.sellerFeeRate.toFixed(1)}%）`;

export function renderResult(input: CalculatorInput, quote: QuoteResult, rateTime: string): string {
  const trafficLabel = input.traffic ? `${input.traffic} ${input.trafficUnit ?? 'TB'}（${input.trafficDirection === 'single' ? '单向' : '双向'}，${input.trafficResetCycle === 'yearly' ? '每年重置' : input.trafficResetCycle === 'none' ? '不重置' : '每月重置'}）` : '';
  const config = [['CPU', input.cpu], ['内存', input.memory ? `${input.memory} ${input.memoryUnit ?? 'GB'}` : ''], ['存储', input.storage ? `${input.storage} ${input.storageUnit ?? 'GB'}` : ''], ['带宽', input.bandwidth ? `${input.bandwidth} ${input.bandwidthUnit ?? 'Mbps'}` : ''], ['流量', trafficLabel], ['位置', input.location]].filter(([, value]) => value);
  return `<div class="result-panel" id="result-panel">
    <div class="result-top"><div><p class="eyebrow">实时结果</p><h2>${input.productName || 'VPS 报价摘要'}</h2><p class="result-subtitle">${[input.provider, input.location].filter(Boolean).join(' · ') || '补充配置后可生成更完整的分享内容'}</p></div><span class="valid-chip">汇率有效</span></div>
    <div class="hero-total"><span>买家总支付 / 卖家到手价</span><strong>${formatCny(quote.totalPrice)}</strong><small>双方金额相等 · 剩余价值 + 计入总价的手续费 + 账户余额</small></div>
    <div class="metric-grid"><div><span>理论剩余价值</span><strong>${formatCny(quote.theoreticalValue)}</strong></div><div><span>折损后建议价</span><strong>${formatCny(quote.adjustedValue)}</strong></div><div><span>剩余周期</span><strong>${quote.remainingDays} 天</strong></div><div><span>售价溢价</span><strong class="${quote.premium >= 0 ? 'positive' : 'negative'}">${quote.premium >= 0 ? '+' : ''}${formatCny(quote.premium)}</strong><small>${quote.premiumRate.toFixed(1)}%</small></div></div>
    <div class="detail-block"><div class="detail-heading"><span>报价明细</span><span class="formula">Push 手续费按卖家承担比例计入</span></div><div class="detail-list"><div><span>剩余价值</span><b>${formatCny(quote.baseSalePrice)}</b></div><div><span>手动溢价</span><b>${formatCny(quote.premiumAmount)}</b></div><div><span>Push 手续费</span><b>${formatCny(quote.pushFeeCny)}</b></div><div><span>承担方式</span><b>${feeModeLabel(input)}</b></div><div><span>计入总价手续费</span><b>${formatCny(quote.includedPushFee)}</b></div><div><span>账户余额</span><b>${formatCnyWithOriginal(quote.balanceCny, quote.balanceAmount, quote.balanceCurrency)}</b></div><div class="emphasis"><span>买家总支付</span><b>${formatCny(quote.buyerTotal)}</b></div><div class="emphasis"><span>卖家到手价</span><b>${formatCny(quote.sellerNet)}</b></div></div></div>
    ${config.length ? `<div class="config-block"><div class="detail-heading"><span>配置摘要</span></div><div class="config-list">${config.map(([label, value]) => `<span><i>${label}</i>${value}</span>`).join('')}</div></div>` : ''}
    <div class="result-meta"><span>交易日 ${input.tradeDate}</span><span>到期日 ${input.expiryDate}</span><span>汇率更新 ${new Date(rateTime).toLocaleString('zh-CN')}</span></div>
    <div class="export-actions"><button class="button primary" id="share-button" type="button">复制分享链接</button><button class="button secondary" id="image-button" type="button">下载图片</button><button class="button ghost" id="markdown-button" type="button">复制 Markdown</button></div>
    <textarea id="markdown-output" class="sr-only" aria-label="Markdown 报价内容"></textarea>
  </div>`;
}
