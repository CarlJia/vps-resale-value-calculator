import type { CalculatorInput, FeeMode, TrafficDirection } from '../domain/types';

const field = (id: string, label: string, type = 'text', placeholder = '', attrs = '') => `
  <label class="field" for="${id}"><span>${label}</span><input id="${id}" type="${type}" placeholder="${placeholder}" ${attrs}></label>`;
const unitField = (id: string, unitId: string, label: string, options: string[], defaultUnit: string, placeholder: string) => `
  <label class="field" for="${id}"><span>${label}</span><span style="display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:8px"><input id="${id}" type="number" min="0" step="0.01" placeholder="${placeholder}"><select id="${unitId}">${options.map((option) => `<option value="${option}"${option === defaultUnit ? ' selected' : ''}>${option}</option>`).join('')}</select></span></label>`;

export function renderForm(): string {
  return `<form id="calculator-form" novalidate>
    <section class="form-section"><div class="section-heading"><div><p class="eyebrow">01 / 成本基线</p><h2>基础信息</h2></div><span id="rate-status" class="status-chip loading">正在获取汇率</span></div>
      <div class="field-grid two">${field('renewal-amount', '续费金额（原币）', 'number', '例如 10', 'min="0" step="0.01" required')}${field('renewal-currency', '续费币种', 'text', 'USD', 'value="USD" maxlength="3" required')}</div>
      <div class="converted-cost"><span>续费成本（人民币）</span><strong id="renewal-cny">等待汇率</strong></div>
      <div class="field-grid two">${field('payment-cycle', '付款周期（月）', 'number', '12', 'min="1" step="1" value="12" required')}${field('trade-date', '交易日期', 'date', '', 'required')}</div>
      <div class="field-grid two">${field('expiry-date', '到期日期', 'date', '', 'required')}${field('discount-rate', '转售折损率 (%)', 'number', '10', 'min="0" max="100" step="0.1" value="10" required')}</div>
    </section>
    <section class="form-section"><div class="section-heading"><div><p class="eyebrow">02 / 成交报价</p><h2>售价与 Push 手续费</h2></div><span class="section-note">总价包含未由卖家承担的手续费</span></div>
      <div class="field-grid two">${field('sale-price', '剩余价值（人民币，自动）', 'number', '等待汇率和日期', 'min="0" step="0.01" readonly required')}${field('premium-amount', '溢价（人民币）', 'number', '例如 20', 'min="0" step="0.01" value="0" required')}</div>
      ${field('push-fee-amount', 'Push 手续费', 'number', '例如 5', 'min="0" step="0.01" value="0" required')}
      <div class="field-grid two">${field('push-fee-currency', '手续费币种', 'text', 'USD', 'value="USD" maxlength="3" required')}<label class="field" for="fee-mode"><span>手续费承担方式</span><select id="fee-mode"><option value="buyer">买家承担（卖家 0%）</option><option value="seller">卖家承担（卖家 100%）</option><option value="split" selected>按比例承担</option></select></label></div>
      <div id="seller-rate-wrap">${field('seller-fee-rate', '卖家承担比例 (%)', 'number', '例如 50', 'min="0" max="100" step="0.1" value="50" required')}</div>
    </section>
    <section class="form-section"><div class="section-heading"><div><p class="eyebrow">03 / 发送信息</p><h2>VPS 配置（可选）</h2></div><span class="section-note">用于报价摘要</span></div>
      <div class="field-grid two">${field('provider', 'VPS 商家', 'text', '例如 Vultr')}${field('product-name', '产品名称', 'text', '例如 Cloud Compute')}</div>
      ${field('highlight', '产品特色', 'text', '例如 高性能 CN2 GIA', 'maxlength="20"')}
      <div class="field-grid two">${field('cpu', 'CPU', 'text', '2 核')}${unitField('memory', 'memory-unit', '内存', ['MB', 'GB', 'TB'], 'GB', '例如 4')}</div>
      <div class="field-grid two">${unitField('storage', 'storage-unit', '存储', ['GB', 'TB'], 'GB', '例如 80')}${unitField('bandwidth', 'bandwidth-unit', '带宽', ['Mbps', 'Gbps'], 'Mbps', '例如 100')}</div>
      <div class="field-grid two">${unitField('traffic', 'traffic-unit', '流量限制', ['GB', 'TB', 'PB'], 'TB', '例如 2')}<label class="field" for="traffic-reset-cycle"><span>流量重置周期</span><select id="traffic-reset-cycle"><option value="monthly" selected>每月</option><option value="yearly">每年</option><option value="none">不重置</option></select></label></div>
      <div class="field-grid two"><label class="field" for="traffic-direction"><span>流量方向</span><select id="traffic-direction"><option value="single">单向</option><option value="double" selected>双向</option></select></label></div>
      ${field('location', '机房位置', 'text', '美国洛杉矶')}
    </section>
    <div class="form-actions"><span class="realtime-note">剩余价值根据续费和到期时间自动更新</span><button class="button ghost" id="reset-button" type="button">重置</button></div>
  </form>`;
}

const ids: Array<keyof CalculatorInput> = ['renewalAmount', 'renewalCurrency', 'paymentCycleMonths', 'tradeDate', 'expiryDate', 'discountRate', 'salePrice', 'premiumAmount', 'pushFeeAmount', 'pushFeeCurrency', 'provider', 'productName', 'highlight', 'cpu', 'memory', 'memoryUnit', 'storage', 'storageUnit', 'bandwidth', 'bandwidthUnit', 'traffic', 'trafficUnit', 'trafficResetCycle', 'trafficDirection', 'location'];

export function readForm(): CalculatorInput {
  const get = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  const feeMode = get('fee-mode') as FeeMode;
  return {
    renewalAmount: Number(get('renewal-amount')), renewalCurrency: get('renewal-currency').trim().toUpperCase(), paymentCycleMonths: Number(get('payment-cycle')),
    tradeDate: get('trade-date'), expiryDate: get('expiry-date'), salePrice: Number(get('sale-price')), premiumAmount: Number(get('premium-amount')), discountRate: Number(get('discount-rate')),
    pushFeeAmount: Number(get('push-fee-amount')), pushFeeCurrency: get('push-fee-currency').trim().toUpperCase(), feeMode,
    sellerFeeRate: feeMode === 'buyer' ? 0 : feeMode === 'seller' ? 100 : Number(get('seller-fee-rate')),
    provider: get('provider'), productName: get('product-name'), highlight: get('highlight'), cpu: get('cpu'), memory: get('memory'),
    storage: get('storage'), storageUnit: get('storage-unit') || 'GB', bandwidth: get('bandwidth'), bandwidthUnit: get('bandwidth-unit') || 'Mbps', traffic: get('traffic'), trafficUnit: get('traffic-unit') || 'TB', trafficResetCycle: get('traffic-reset-cycle') || 'monthly', trafficDirection: (get('traffic-direction') || 'double') as TrafficDirection, location: get('location'), memoryUnit: get('memory-unit') || 'GB',
  };
}

export function fillForm(input: CalculatorInput): void {
  const mapping: Record<string, string | number> = {
    'renewal-amount': input.renewalAmount, 'renewal-currency': input.renewalCurrency, 'payment-cycle': input.paymentCycleMonths,
    'trade-date': input.tradeDate, 'expiry-date': input.expiryDate, 'discount-rate': input.discountRate, 'sale-price': input.salePrice,
    'premium-amount': input.premiumAmount ?? 0, 'push-fee-amount': input.pushFeeAmount, 'push-fee-currency': input.pushFeeCurrency, 'fee-mode': input.feeMode, 'seller-fee-rate': input.sellerFeeRate,
    provider: input.provider, 'product-name': input.productName, highlight: input.highlight, cpu: input.cpu, memory: input.memory,
    storage: input.storage, 'storage-unit': input.storageUnit ?? 'GB', bandwidth: input.bandwidth, 'bandwidth-unit': input.bandwidthUnit ?? 'Mbps', traffic: input.traffic, 'traffic-unit': input.trafficUnit ?? 'TB', 'traffic-reset-cycle': input.trafficResetCycle ?? 'monthly', 'traffic-direction': input.trafficDirection ?? 'double', location: input.location, 'memory-unit': input.memoryUnit ?? 'GB',
  };
  Object.entries(mapping).forEach(([id, value]) => { const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null; if (element) element.value = String(value); });
  updateFeeModeVisibility();
}

export function updateFeeModeVisibility(): void {
  const mode = (document.getElementById('fee-mode') as HTMLSelectElement | null)?.value;
  const wrap = document.getElementById('seller-rate-wrap');
  if (wrap) { wrap.classList.toggle('hidden', mode !== 'split'); }
}
